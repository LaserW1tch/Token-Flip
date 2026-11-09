# Token Flip

Token Flip lets you save up to six alternate token images per Actor and choose among them from the Token controls. It works with player characters and NPCs.

## Features

- Save, replace, or clear any of six alternate art slots for an Actor.
- Preview the token's normal art and every populated alternate slot before choosing.
- Keep the first prototype's `alternateTexture` Actor flag as slot 1 for compatibility.
- Optionally open VTTA Tokenizer when choosing an image. Without Tokenizer, the chosen image is saved directly.
- View a permissions note in Configure Settings → Token Flip.

## Requirements

- Foundry Virtual Tabletop 14.367 or newer within the manifest's compatibility range.
- VTTA Tokenizer is optional. When it is active, it can be used to edit the selected image before saving it.

## Install

In Foundry or The Forge, install using this manifest URL:

`https://raw.githubusercontent.com/LaserW1tch/Token-Flip/main/module.json`

Enable **Token Flip** in the world's Manage Modules screen. On a scene, select one token and use the Token controls **Manage Alternate Token Art** to set its slots, then **Choose Token Art** to preview and apply an image.

Users need permission to browse files and update the Actor. They need upload permission only when uploading their own images. When using Tokenizer, its Trusted Player and output-folder permissions also apply. The module's **View Permissions Note** setting summarizes these requirements.

## Manual installation

Download the zip attached to the latest GitHub release and extract it into Foundry's `Data/modules` folder. The extracted directory should be named `token-flip` and contain `module.json` at its root.
