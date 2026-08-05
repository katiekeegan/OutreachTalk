# Third-party notices

## QR code generator

`public/vendor/qr-svg.js` contains adapted source from the `qrcode-terminal` package and Kazuhiko Arase's QR Code Generator implementation.

- `qrcode-terminal` is distributed under the Apache License 2.0.
- The underlying QR Code Generator source includes the following notice:

> Copyright (c) 2009 Kazuhiko Arase. Licensed under the MIT License.

The adapted file is bundled locally so presenter QR codes can be generated for the actual deployed address without sending audience URLs to an external QR service.
