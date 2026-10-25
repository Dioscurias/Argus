# Reference geography

`countries.geojson` is Natural Earth **1:110m Admin 0 Countries**, downloaded on 2026-10-25 from:

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

Dataset repository: https://github.com/nvkelso/natural-earth-vector

License: public domain. https://www.naturalearthdata.com/about/terms-of-use/

The 177 feature geometries are retained. Properties are reduced to `name` (upstream `NAME_EN`) and `iso` (upstream `ADM0_A3`) to keep the client payload small. This is a low-resolution global reference map, not street data or navigation-grade geography. Boundaries do not imply a position on sovereignty.

All Phase 0 traffic records are generated separately and are not part of Natural Earth.
