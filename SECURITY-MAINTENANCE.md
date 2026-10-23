# Archive dependency compatibility

The tar override installs 7.5.22 to remove critical archive vulnerabilities in tar 6.
Capacitor CLI 4.6.0 expects a default export that tar 7 no longer provides. The
tracked patch changes template extraction to use tar 7's named `extract` export.
`npm ci` applies the patch automatically; installation fails if it no longer applies.

Keep the CLI pinned while this patch is needed. When upgrading Capacitor, review
and remove the patch if the CLI supports tar 7 directly. Validate both Android and
iOS platform template extraction and web asset copying after dependency changes.
