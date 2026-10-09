# sfx-ui-shell-footer

One declared provider, one identically named folder. Version 0.2.0.
Implements the footer region from the landing/region blueprints.
The provider serves only its own three CSS/HTML/SVG assets; requests for another region refuse.
Shared loading mechanics live in src/ui-providers/region-provider.mjs.

The hosted API route is /ui-providers/sfx-ui-shell-footer. Its package identity and candidate
providerId are sfx-ui-shell-footer; its capability is ui-region-footer.

HTTP availability does not itself select an estate execution binding.
