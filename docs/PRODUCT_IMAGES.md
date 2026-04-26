# Product Images: Sourcing & Quality Improvements

## Current Source

**Open Food Facts (OFF) API** — `src/lib/openfoodfacts.ts`

- All product images are fetched from the [Open Food Facts](https://world.openfoodfacts.org) public database
- Images are user-submitted and **not moderated** for quality, professionalism, or accuracy
- Query: `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=image_url`
- Image field: `product.image_url` (often low resolution, blurry, or poorly framed)

### Why This Happens

1. **User-Generated Content**: OFF relies on volunteers to photograph products. Quality varies wildly.
2. **No Curation**: Unlike professional product databases, OFF doesn't validate image quality before accepting uploads.
3. **Mobile Scans**: Many images are quick phone snapshots, not professional product shots.
4. **India-Specific Gap**: Smaller Indian brands may have very few images on OFF, especially for regional products.

## Quality Issues Observed

- Blurry or out-of-focus shots
- Wrong angle or partially visible packaging
- Multiple duplicate images for the same product
- Images of people/hands instead of product
- Text-heavy images with ingredient lists (confusing UX)
- Low resolution or heavily compressed

## Solutions to Implement

### Option 1: Manual Image Upload (Easiest, High-Impact)
**Effort**: Low | **Quality**: High | **Speed**: Immediate

1. Add an "Upload Better Image" button on product pages
2. Let users submit professional images directly to Supabase
3. Store in a `products` table with `image_url_override` column
4. Prioritize override images over OFF images in UI

**Implementation**:
```typescript
// In src/app/product/[id]/page.tsx
const imageToDisplay = product.image_url_override || product.image_url;
```

### Option 2: Bulk Image Import (Medium Effort, Sustainable)
**Effort**: Medium | **Quality**: Very High | **Speed**: One-time or periodic

1. Partner with Indian CPG brands (Cornitos, ITC, Britannia, etc.)
2. Request official product images + metadata (JSON)
3. Bulk import to Supabase with `image_source: "official"`
4. Tag official images so users know they're verified

**Data Structure**:
```json
{
  "barcode": "8904000000000",
  "name": "Cornitos Nacho Crisps Cheese & Herbs",
  "image_url": "off-url-fallback",
  "image_url_official": "cdn-url-to-official-image",
  "image_source": "official" // or "off" or "user"
}
```

### Option 3: Image Caching & CDN (Technical, Reliability)
**Effort**: Low | **Quality**: Same | **Speed**: Faster loads

1. Cache OFF images to Supabase Storage or Cloudinary
2. Replace `image_url` with cached CDN URLs
3. Reduces dependency on OFF's uptime

```typescript
const cachedImageUrl = `https://cdn.sift.app/products/${barcode}.jpg`;
```

### Option 4: Default Fallback Images (Low Effort, Stops Unprofessional Images)
**Effort**: Very Low | **Quality**: Acceptable | **Speed**: Immediate

If an image looks unprofessional, show a category-based placeholder instead.

```typescript
function getImageUrl(product: Product): string {
  if (!product.image_url || isLowQualityImage(product.image_url)) {
    return getCategoryPlaceholder(product.category);
  }
  return product.image_url;
}
```

### Option 5: AI Image Enhancement (Advanced, Experimental)
**Effort**: High | **Quality**: Variable | **Speed**: Slow (API calls)

Use Google Vision API or similar to detect blurry/low-quality images and upscale or re-enhance them. Not recommended for core UX due to latency.

## Recommended Approach

**For MVP**: Option 1 + Option 4
- Let users upload better images immediately
- Show category placeholders for garbage OFF images
- Fast to implement, high user satisfaction

**For Scale**: Option 1 + Option 2
- Official brand partnerships fill in high-volume products
- User uploads fill in long-tail/regional products
- Most sustainable long-term

## Implementation Checklist

- [ ] Add `image_url_override` column to `products` table
- [ ] Add image upload button to product detail page
- [ ] Create Supabase Storage bucket for user-uploaded images
- [ ] Update product image selection logic to prefer override images
- [ ] Add image quality check (if blurry, show placeholder)
- [ ] Create category placeholder images (6 categories × 5 sizes = 30 images)
- [ ] Document image upload API endpoint

## File Locations

- **Image Fetching**: `src/lib/openfoodfacts.ts`
- **Product Detail UI**: `src/app/product/[id]/page.tsx` (line ~300)
- **Image Selection Logic**: Search for `product.image_url` in product page
- **DB Types**: `src/lib/database.types.ts`

## Notes for Designers

The current OFF images in your screenshots (Cornitos Nacho Crisps) are actually **typical** of the database. To get better images:
1. Manually source brand images from company websites
2. Use professional product photography
3. Implement user-submission feature with moderation queue

Would not recommend relying on OFF for professional UX without one of the above solutions.
