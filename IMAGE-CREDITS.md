# Section photography — sources and licences

Every image in `public/img/` is released under CC0 or the Public Domain Mark,
which permits commercial use with **no attribution required**. This file records
provenance; it is not a legal obligation.

Nothing here came from Pinterest, Google Images, or any other source whose
photographs belong to someone who has not licensed them for this use.

The menu is 100% vegetarian, so every photograph was checked by eye for meat
before it was accepted. Several otherwise good candidates were rejected on
those grounds (a prosciutto pizza, fried chicken passed off by the search as
'fries', a pork noodle bowl).

| Section | Licence | Delivered | Fetched | Full original | Source |
|---|---|---|---|---|---|
| `baked` | CC0 1.0 | 1024x341 | 1024x821 | 3024x2423 | rawpixel [link](https://www.rawpixel.com/image/3304130/free-photo-image-sandwiches-baking-paper) |
| `burger` | CC0 1.0 | 1024x341 | 1024x683 | 5760x3840 | rawpixel [link](https://www.rawpixel.com/image/5953867/free-public-domain-cc0-photo) |
| `coffee` | CC0 1.0 | 1024x341 | 1024x683 | 5338x3559 | rawpixel [link](https://www.rawpixel.com/image/5927781/photo-image-public-domain-gold-wooden) |
| `dessert` | CC0 1.0 | 766x255 | 766x1024 | 3456x4620 | rawpixel [link](https://www.rawpixel.com/image/5908901/image-public-domain-summer-food) |
| `fries` | CC0 1.0 | 1024x341 | 1024x683 | 3543x2362 | rawpixel [link](https://www.rawpixel.com/image/5914552/image-public-domain-food-free) |
| `maggie` | CC0 1.0 | 1024x341 | 1024x683 | 6000x4000 | rawpixel [link](https://www.rawpixel.com/image/5927588/free-noodle-image-public-domain-food-cc0-photo) |
| `manchurian` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/292682210a/) |
| `mojito` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/5469f76616/) |
| `momo` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/10768dbafc/) |
| `noodles` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/2726a17a64/) |
| `paneer` | CC0 1.0 | 1200x400 | 2048x1536 | 2048x1536 | wordpress [link](https://wordpress.org/photos/photo/6376a2a4b2/) |
| `pasta` | CC0 1.0 | 1024x341 | 1024x683 | 4608x3072 | rawpixel [link](https://www.rawpixel.com/image/5921451/photo-image-cloud-public-domain-nature) |
| `pizza` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/9516528906/) |
| `rice` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/9966a2a857/) |
| `sandwich` | CC0 1.0 | 1152x384 | 1152x2048 | 1152x2048 | wordpress [link](https://wordpress.org/photos/photo/48765be037/) |
| `shakes` | CC0 1.0 | 1024x341 | 1024x683 | 6000x4000 | rawpixel [link](https://www.rawpixel.com/image/447779/strawberry-smoothie) |
| `soup` | CC0 1.0 | 1024x341 | 1024x683 | 5184x3456 | rawpixel [link](https://www.rawpixel.com/image/5924545/photo-image-public-domain-food-water) |
| `twister` | CC0 1.0 | 1200x400 | 1536x2048 | 1536x2048 | wordpress [link](https://wordpress.org/photos/photo/143698b2a1/) |

## On resolution

**Delivered** is what ships. **Fetched** is what the Openverse image URL
actually returned — it serves a 1024px preview for many providers, not the
full file. **Full original** is what exists on the source site, up to
6000×4000, reachable through the link.

The hero strip renders about 340px wide on a phone and 524px on a desktop, at
140px tall. Delivering 1024–1200px wide is therefore already 2–3× the on-screen
size, which is past the point where a phone can show any more detail. Shipping
genuine 4K files here would multiply the page weight by roughly twenty and look
identical — worse, in fact, on the cafe's wifi. If print or social assets are
ever needed, follow the source links for the full-resolution files.

## Format

Each section is written twice: WebP (what almost every browser gets) and JPEG
(fallback), centre-cropped to 3:1, lazily loaded. Total WebP payload across all
eighteen sections is about 750KB, and a customer only downloads the sections
they actually scroll past.

## Replacing one

Drop a new `<section>.webp` and `<section>.jpg` into `public/img/` using the
same names, cropped 3:1. No code change needed. To fall back to the drawn glyph
panel instead, remove that section's key from `SEC_PHOTO` in
`public/index.html`.

The cafe's own menu photographs are preserved in `cafe-photos-original/` — see
the README there.
