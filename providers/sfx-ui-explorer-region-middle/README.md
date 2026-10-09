# sfx-ui-explorer-region-middle

One declared provider, one identically named folder. Version 0.1.0.
Implements the middle region from the landing/region blueprints.
The provider serves only its own three CSS/HTML/SVG assets; requests for another region refuse.
Shared loading mechanics live in src/ui-providers/region-provider.mjs.

The hosted API route is /ui-providers/sfx-ui-explorer-region-middle. Its package identity and candidate
providerId are sfx-ui-explorer-region-middle; its capability is ui-region-middle.

HTTP availability does not itself select an estate execution binding.
