/** Review-only fixtures. No network fallback and no proposed backend contract. */
export type SampleProduct = {
  id: string;
  name: string;
  vendor: string;
  priceKobo: number;
  image: string;
  category: string;
  label?: string;
  rating?: string;
  reviews?: number;
  previousPriceKobo?: number;
  discount?: string;
  stockLabel?: string;
};

export function formatNaira(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100);
}

const asset = (section: string, index: number) => `/images/landing/${section}-${index}.png`;
const product = (id: string, name: string, vendor: string, priceKobo: number, category: string, image: string, extra: Partial<SampleProduct> = {}): SampleProduct => ({ id, name, vendor, priceKobo, category, image, ...extra });

const deals = [
  product('galaxy-a55', 'Samsung Galaxy A55 5G (256GB)', 'AfriTech Direct', 38500000, 'Electronics', asset('174-530', 0), { rating: '4.8', reviews: 124, previousPriceKobo: 44000000, discount: '-12%', stockLabel: '14 left in stock' }),
  product('field-satchel', 'Horween Veg-Tan Field Satchel', 'Tanner & Forge', 32000000, 'Fashion', asset('174-530', 1), { rating: '4.9', reviews: 42, previousPriceKobo: 36000000, discount: '-11%', stockLabel: '4 left in stock' }),
  product('soundcore', 'Anker Soundcore Space One ANC', 'Volt Gadgets', 9800000, 'Electronics', asset('174-530', 2), { rating: '4.7', reviews: 89, previousPriceKobo: 12500000, discount: '-21%', stockLabel: '8 left in stock' }),
  product('tea-set', 'Ojai Matte Clay Tea Set (3-Pc)', 'Kobo Pottery', 18500000, 'Home Living', asset('174-530', 3), { rating: '5.0', reviews: 18, previousPriceKobo: 21000000, discount: '-12%', stockLabel: 'Limited Edition' }),
  product('chinos', 'Defacto Men Slim-Fit Chino Trousers', 'Urban Threads', 2450000, 'Fashion', asset('174-530', 4), { rating: '4.6', reviews: 63, previousPriceKobo: 3200000, discount: '-23%', stockLabel: 'In Stock' }),
  product('tamper', 'Breville Precision Espresso Tamper', 'BrewCraft Lagos', 6200000, 'Kitchenware', asset('174-530', 5), { rating: '4.9', reviews: 31, previousPriceKobo: 7800000, discount: '-20%', stockLabel: '11 left in stock' }),
];
const popular = [
  product('walnut-stool', 'Solid Walnut Mortise Stool', 'Grain & Mortar Studio', 24000000, 'Home Living', asset('174-765', 0), { rating: '4.9', reviews: 76 }),
  product('ipad-air', 'Apple iPad Air 11″ M2 (128GB)', 'iStore West Africa', 74500000, 'Computing', asset('174-765', 1), { rating: '4.9', reviews: 214 }),
  product('brass-sconce', 'Hand-Hammered Brass Sconce', 'Aalto Foundry', 14500000, 'Home Living', asset('174-765', 2), { rating: '4.8', reviews: 34 }),
  product('cleanser', 'CeraVe Hydrating Cleanser 473ml', 'PureGlow Pharmacy', 1850000, 'Health & Beauty', asset('174-765', 3), { rating: '4.9', reviews: 530 }),
  product('sony-headphones', 'Sony WH-1000XM5 Headphones', 'SoundStage NG', 42000000, 'Electronics', asset('174-765', 4), { rating: '4.9', reviews: 189 }),
];
const collections = [
  { id: 'phones', title: 'Phones, Tablets & Audio', description: 'Explore phones, personal audio, and everyday technology.', link: 'See Category Hub', icon: 15, products: [
    product('iphone', 'iPhone 15 Pro (128GB)', 'AfriTech Direct', 118000000, 'Phones & Tablets', asset('174-869', 0), { label: 'Apple Certified' }),
    product('tecno', 'Tecno Camon 30 Premier 5G', 'MobilePlanet NG', 48500000, 'Phones & Tablets', asset('174-869', 1), { label: 'Tecno Official' }),
    product('jbl', 'JBL Charge 5 Portable Speaker', 'SoundStage NG', 16500000, 'Electronics', asset('174-869', 2), { label: 'JBL Official' }),
    product('macbook', 'MacBook Air 13″ M3', 'iStore West Africa', 145000000, 'Computing', asset('174-869', 3), { label: 'Apple Certified' }),
    product('buds', 'Galaxy Buds2 Pro Wireless', 'Volt Gadgets', 13800000, 'Electronics', asset('174-869', 4), { label: 'Samsung Official' }),
  ] },
  { id: 'fashion', title: 'Fashion, Bags & Apparel', description: 'Curated tailoring, artisanal footwear, and authentic textiles.', link: 'See Wardrobe Hub', icon: 17, products: [
    product('loafers', 'Calfskin Penny Loafers', 'Tanner & Forge', 7800000, 'Footwear', asset('174-869', 5), { label: 'Artisan Footwear' }),
    product('adire', 'Adire Indigo Wrap Dress', 'Loom & Weft', 4200000, 'Fashion', asset('174-869', 6), { label: 'Hand-Dyed Textile' }),
    product('tote', 'Canvas & Leather Daily Tote', 'Kobo Crafts', 3850000, 'Accessories', asset('174-869', 7), { label: 'Everyday Carry' }),
    product('linen', 'Natural Flax Linen Shirt', 'Urban Threads', 2900000, 'Fashion', asset('174-869', 8), { label: 'Pure Linen' }),
    product('ring', 'Sunburst Brass Signet Ring', 'Aalto Foundry', 1950000, 'Accessories', asset('174-869', 9), { label: 'Artisan Jewelry' }),
  ] },
  { id: 'home-living', title: 'Home, Living & Appliances', description: 'Functional culinary appliances, hand-woven decor, and workspace ergonomics.', link: 'See Homeware Hub', icon: 18, products: [
    product('air-fryer', 'Ninja DualZone Air Fryer 7.6L', 'BrewCraft Lagos', 21500000, 'Kitchenware', asset('174-869', 10), { label: 'Kitchen Appliance' }),
    product('dutch-oven', 'Enameled Dutch Oven 5.5L', 'Grain & Mortar', 8900000, 'Kitchenware', asset('174-869', 11), { label: 'Cast Iron Cookware' }),
    product('desk-chair', 'Aeron Pro Ergonomic Desk Chair', 'Workspace NG', 31000000, 'Home Living', asset('174-869', 12), { label: 'Ergonomic Furniture' }),
    product('basket', 'Calabar Woven Raffia Basket', 'Loom & Weft', 2200000, 'Home Living', asset('174-869', 13), { label: 'Hand-Woven Craft' }),
    product('kettle', 'Stagg EKG Electric Pour Kettle', 'BrewCraft Lagos', 14200000, 'Kitchenware', asset('174-869', 14), { label: 'Barista Gear' }),
  ] },
];
const vendors = [
  { name: 'Tanner & Forge', initials: 'TF', description: 'Master Leathercraft Atelier', badge: 'Grade A Audit', fulfilled: '584 fulfilled' },
  { name: 'AfriTech Direct', initials: 'AT', description: 'Official Electronics Hub', badge: 'Tier 1 Partner', fulfilled: '2,400+ fulfilled' },
  { name: 'Kobo Pottery', initials: 'KP', description: 'Ceramic Art & Homeware', badge: 'Guild Verified', fulfilled: '312 fulfilled' },
  { name: 'Loom & Weft', initials: 'LW', description: 'Handcrafted Textiles', badge: 'Abeokuta Guild', fulfilled: '420 fulfilled' },
].map((vendor, index) => ({ ...vendor, images: [0, 1, 2].map(offset => asset('174-1116', index * 3 + offset)) }));
const recent = [deals[1], deals[3], deals[2]].map((item, index) => ({ ...item, image: asset('174-1248', index) }));
const explore = [
  product('candle', 'Artisan Amber Candle', 'Aromatherapy Guild', 1400000, 'Home Living', asset('174-1248', 3)),
  product('bookends', 'Calacatta Bookends (Pair)', 'Aalto Foundry', 5200000, 'Home Living', asset('174-1248', 4)),
  product('rollerball', 'Turned Bamboo Rollerball', 'Grain & Mortar', 2650000, 'Accessories', asset('174-1248', 5)),
];

/** Explicit mock adapter; replace only after agreeing a real homepage contract. */
export function getSampleHomepage() {
  return { mode: 'sample' as const, deals, popular, collections, vendors, recent, explore };
}
