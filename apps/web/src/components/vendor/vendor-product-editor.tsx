'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import {
  editVendorProduct,
  uploadProductImage,
  type VendorProduct,
} from '../../lib/client/marketplace';
import { Icon } from '../ui/icon';
import styles from './vendor-product-editor.module.css';

const categories = ['flowers', 'cakes', 'hampers', 'personalised-gifts', 'fashion', 'home', 'other'];

type Props = {
  product: VendorProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function VendorProductEditor({ product, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [category, setCategory] = useState(product.category);
  const [sku, setSku] = useState(product.sku);
  const [price, setPrice] = useState(String(product.priceKobo / 100));
  const [stock, setStock] = useState(String(product.stockQuantity));
  const [imagePath, setImagePath] = useState<string | null>(product.imagePath);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = product.reservedQuantity > 0;

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await uploadProductImage(file);
      setImagePath(result.imagePath);
      setNotice('The new image was uploaded securely and is waiting for Fendora review. Save the listing to connect it.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The image could not be uploaded.');
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await editVendorProduct(product.id, {
        version: product.version,
        title,
        description,
        category,
        imagePath,
        sku,
        priceKobo: Math.round(Number(price) * 100),
        stockQuantity: Number(stock),
      });
      await onSaved();
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The listing could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.editorOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
    <button className={styles.editorBackdrop} aria-label="Close product editor" onClick={onClose} />
    <form className={styles.editorDrawer} onSubmit={save}>
      <header>
        <div><small>PRODUCT CATALOGUE</small><h2 id="edit-product-title">Edit listing</h2></div>
        <button type="button" className={styles.iconButton} aria-label="Close product editor" onClick={onClose}><Icon name="x" /></button>
      </header>
      {notice && <div className={styles.notice}>{notice}</div>}
      {locked && <div className={styles.warning}><Icon name="alert-triangle" /><div><b>This listing has reserved stock</b><p>Fendora protects active customer requests. Contact support before changing this listing.</p></div></div>}
      {!locked && product.status !== 'draft' && <div className={styles.reviewWarning}><b>Saving sends this listing back to draft.</b><span>Submit it again after the image and product information are ready for a fresh Fendora review.</span></div>}
      <div className={styles.editorPreview}>
        {imagePath ? <Image src={imagePath} width={92} height={92} alt="Current product preview" unoptimized /> : <span><Icon name="image" size={30} /></span>}
        <label>Replace product image<input disabled={busy || locked} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /><small>JPEG, PNG or WebP · maximum 5 MB</small></label>
      </div>
      <label>Product title<input disabled={locked} required minLength={2} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Category<select disabled={locked} value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></label>
      <label>Description<textarea disabled={locked} required minLength={10} rows={5} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <div className={styles.two}>
        <label>SKU<input disabled={locked} required value={sku} onChange={event => setSku(event.target.value)} /></label>
        <label>Price (NGN)<input disabled={locked} required min="1" step="0.01" type="number" value={price} onChange={event => setPrice(event.target.value)} /></label>
      </div>
      <label>Stock quantity<input disabled={locked} required min={product.reservedQuantity} step="1" type="number" value={stock} onChange={event => setStock(event.target.value)} /><small>{product.reservedQuantity} currently reserved · {Math.max(0, Number(stock || 0) - product.reservedQuantity)} available after saving</small></label>
      <footer><button type="button" className={styles.secondary} onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy || locked}>{busy ? 'Saving changes…' : 'Save changes'}</button></footer>
    </form>
  </div>;
}
