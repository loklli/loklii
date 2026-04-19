-- Update existing categories and remove unwanted ones

-- Update kept categories with new names/icons
UPDATE categories SET name = 'Home-cooked meals',     name_ar = 'وجبات منزلية',          name_es = 'Comida casera',               icon = '🍽️', sort_order = 1 WHERE slug = 'food-cooking';
UPDATE categories SET name = 'Baked goods & pastries', name_ar = 'مخبوزات وحلويات',       name_es = 'Repostería y pasteles',        icon = '🧁', sort_order = 2 WHERE slug = 'baked-goods';
UPDATE categories SET name = 'Beauty & nail care',     name_ar = 'جمال وعناية بالأظافر',  name_es = 'Belleza y cuidado de uñas',   icon = '💅', sort_order = 3 WHERE slug = 'beauty-hair';
UPDATE categories SET name = 'Henna & body art',       name_ar = 'حناء وفن الجسد',        name_es = 'Henna y arte corporal',        icon = '🌿', sort_order = 4 WHERE slug = 'henna-art';
UPDATE categories SET sort_order = 5                                                                                                              WHERE slug = 'other';

-- Remove unwanted categories
DELETE FROM categories WHERE slug IN ('tutoring', 'childcare', 'pet-care', 'cleaning', 'alterations-sewing', 'wellness-massage');
