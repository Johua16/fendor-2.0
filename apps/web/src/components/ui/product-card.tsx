import type { SampleProduct } from '@/lib/api/homepage';
import { formatNaira } from '@/lib/api/homepage';
import { Button } from './button';
import { DesignIcon } from './design-icon';

export function ProductCard({ product, variant = 'collection', saved = false, onSave, onView, onAdd }: {
  product: SampleProduct;
  variant?: 'deal' | 'popular' | 'collection';
  saved?: boolean;
  onSave?: (product: SampleProduct) => void;
  onView: (product: SampleProduct) => void;
  onAdd: (product: SampleProduct) => void;
}) {
  return <article className={`product-card product-card--${variant}`}>
    <div className="product-card__visual">
      <button className="product-card__image-button" onClick={() => onView(product)} aria-label={`Preview ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" /></button>
      {product.discount && <span className="product-card__discount">{product.discount}</span>}
      {onSave && <button className="product-card__save" aria-label={`${saved ? 'Unsave' : 'Save'} ${product.name}`} aria-pressed={saved} onClick={() => onSave(product)}><DesignIcon section="174-530" index={11} /><span className="visually-hidden">{saved ? 'Saved' : 'Save'}</span></button>}
    </div>
    <div className="product-card__details">
      <p className="product-card__eyebrow">{variant === 'deal' && <DesignIcon section="174-530" index={8} />}{product.label || product.vendor}</p>
      <h3><button onClick={() => onView(product)}>{product.name}</button></h3>
      {product.rating && <p className="product-card__rating"><DesignIcon section="174-765" index={6} /><span>{product.rating}</span><span className="muted">({product.reviews})</span></p>}
      <p className="product-card__price">{formatNaira(product.priceKobo)}{product.previousPriceKobo && <del>{formatNaira(product.previousPriceKobo)}</del>}</p>
      {variant === 'collection' && <p className="product-card__vendor">{product.vendor}</p>}
      {product.stockLabel && <div className="product-card__stock"><span aria-hidden="true" /><small>{product.stockLabel} · sample</small></div>}
    </div>
    <Button variant={variant === 'popular' ? 'secondary' : 'outline'} size="compact" onClick={() => variant === 'popular' ? onView(product) : onAdd(product)}>
      {variant === 'deal' && <DesignIcon section="174-530" index={10} />}{variant === 'popular' ? 'Quick View' : 'Add to Cart'}
    </Button>
  </article>;
}
