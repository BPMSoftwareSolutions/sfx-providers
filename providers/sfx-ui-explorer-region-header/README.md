# sfx-ui-explorer-region-header

One declared provider, one identically named folder. Version 0.1.0.
Implements the header region from the landing/region blueprints.
The provider serves only its own three CSS/HTML/SVG assets; requests for another region refuse.
Shared loading mechanics live in src/ui-providers/region-provider.mjs.

The hosted API route is /ui-providers/sfx-ui-explorer-region-header. Its package identity and candidate
providerId are sfx-ui-explorer-region-header; its capability is ui-region-header.

HTTP availability does not itself select an estate execution binding.
