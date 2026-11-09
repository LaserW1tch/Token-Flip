const MODULE_ID = "token-flip";

class TokenFlipPermissions extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "token-flip-permissions",
    window: { title: "TOKEN_FLIP.Settings.Title" },
    position: { width: 540 }
  };

  static PARTS = {
    main: { template: "modules/token-flip/templates/permissions.hbs" }
  };
}

class TokenFlipArtChoices extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "token-flip-art-choices",
    classes: ["token-flip-art-choices"],
    window: { title: "TOKEN_FLIP.Controls.ChooseArt" },
    position: { width: 560, height: "auto" },
    actions: {
      "choose-art": TokenFlipArtChoices.#chooseArt
    }
  };

  static PARTS = {
    main: { template: "modules/token-flip/templates/art-choices.hbs" }
  };

  constructor(token, choices) {
    super();
    this.token = token;
    this.choices = choices;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, choices: this.choices };
  }

  static async #chooseArt(_event, target) {
    const choice = this.choices[Number(target.dataset.choiceIndex)];
    if (!choice) return;
    await applyTokenArt(this.token, choice);
    await this.close();
  }
}

function getSingleControlledToken() {
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    ui.notifications.warn(game.i18n.localize("TOKEN_FLIP.Errors.SelectOne"));
    return null;
  }

  const token = controlled[0];
  if (!token.actor) {
    ui.notifications.warn(game.i18n.localize("TOKEN_FLIP.Errors.NoActor"));
    return null;
  }
  return token;
}

function getAlternateArtSlots(actor) {
  const stored = actor.getFlag(MODULE_ID, "alternateTextures");
  if (Array.isArray(stored)) {
    return Array.from({ length: 6 }, (_, index) => stored[index] || "");
  }

  const slots = Array(6).fill("");
  const legacyAlternate = actor.getFlag(MODULE_ID, "alternateTexture");
  if (legacyAlternate) slots[0] = legacyAlternate;
  return slots;
}

async function openAlternateArtPicker() {
  const token = getSingleControlledToken();
  if (!token) return;

  const slots = getAlternateArtSlots(token.actor);
  const options = slots.map((path, index) => {
    const label = game.i18n.format("TOKEN_FLIP.Settings.SlotLabel", { slot: index + 1 });
    const status = game.i18n.localize(path
      ? "TOKEN_FLIP.Settings.SlotSet"
      : "TOKEN_FLIP.Settings.SlotEmpty");
    return `<option value="${index}">${label} — ${status}</option>`;
  }).join("");

  const selection = await foundry.applications.api.DialogV2.wait({
    window: { title: "TOKEN_FLIP.Settings.ChooseSlot" },
    content: `<div class="form-group"><label>${game.i18n.localize("TOKEN_FLIP.Settings.ChooseSlot")}</label><select name="slot">${options}</select></div>`,
    rejectClose: false,
    modal: true,
    buttons: [
      {
        action: "choose-image",
        label: "TOKEN_FLIP.Settings.ChooseImage",
        default: true,
        callback: (_event, button) => ({ action: "choose", slot: Number(button.form.elements.slot.value) })
      },
      {
        action: "clear-slot",
        label: "TOKEN_FLIP.Settings.ClearSlot",
        callback: (_event, button) => ({ action: "clear", slot: Number(button.form.elements.slot.value) })
      }
    ]
  });

  if (!selection || !Number.isInteger(selection.slot) || selection.slot < 0 || selection.slot > 5) return;
  if (selection.action === "clear") {
    const updated = getAlternateArtSlots(token.actor);
    updated[selection.slot] = "";
    try {
      await token.actor.setFlag(MODULE_ID, "alternateTextures", updated);
      ui.notifications.info(game.i18n.format("TOKEN_FLIP.Notifications.SlotCleared", {
        name: token.actor.name,
        slot: selection.slot + 1
      }));
    } catch (error) {
      console.error(`${MODULE_ID} | Could not clear alternate art`, error);
      ui.notifications.error(error.message ?? String(error));
    }
    return;
  }

  const picker = new foundry.applications.apps.FilePicker({
    type: "image",
    current: slots[selection.slot] || "",
    callback: path => {
      if (!path) return;

      const tokenizerModule = game.modules.get("vtta-tokenizer");
      const tokenizer = tokenizerModule?.active
        ? tokenizerModule.api ?? window.Tokenizer
        : null;

      if (typeof tokenizer?.launch === "function") {
        try {
          tokenizer.launch({
            name: token.actor.name,
            type: "pc",
            tokenFilename: path,
            nameSuffix: `-alternate-${selection.slot + 1}`
          }, async result => {
            const finishedPath = result?.tokenFilename;
            if (finishedPath) await saveAlternateArt(token, selection.slot, finishedPath);
          });
        } catch (error) {
          console.error(`${MODULE_ID} | Tokenizer could not be opened`, error);
          ui.notifications.warn(game.i18n.localize("TOKEN_FLIP.Notifications.TokenizerFallback"));
          void saveAlternateArt(token, selection.slot, path);
        }
        return;
      }

      void saveAlternateArt(token, selection.slot, path);
    }
  });
  picker.render({ force: true });
}

async function saveAlternateArt(token, slotIndex, path) {
  try {
    const slots = getAlternateArtSlots(token.actor);
    slots[slotIndex] = path;
    await token.actor.setFlag(MODULE_ID, "alternateTextures", slots);
    ui.notifications.info(game.i18n.format("TOKEN_FLIP.Notifications.SlotSaved", {
      name: token.actor.name,
      slot: slotIndex + 1
    }));
  } catch (error) {
    console.error(`${MODULE_ID} | Could not save alternate art`, error);
    ui.notifications.error(error.message ?? String(error));
  }
}

async function openTokenArtChoices() {
  const token = getSingleControlledToken();
  if (!token) return;

  const original = token.document.getFlag(MODULE_ID, "originalTexture") || token.document.texture.src;
  const slots = getAlternateArtSlots(token.actor);
  const choices = [{
    path: original,
    label: game.i18n.localize("TOKEN_FLIP.Settings.NormalArt"),
    alternateSlot: null
  }];
  for (const [index, path] of slots.entries()) {
    if (!path) continue;
    choices.push({
      path,
      label: game.i18n.format("TOKEN_FLIP.Settings.AlternateArt", { slot: index + 1 }),
      alternateSlot: index
    });
  }
  const currentTexture = token.document.texture.src;
  for (const choice of choices) choice.isCurrent = choice.path === currentTexture;

  if (choices.length === 1) {
    ui.notifications.warn(game.i18n.localize("TOKEN_FLIP.Errors.NoAlternateSlots"));
    return;
  }

  new TokenFlipArtChoices(token, choices).render({ force: true });
}

async function applyTokenArt(token, choice) {
  const document = token.document;
  const original = document.getFlag(MODULE_ID, "originalTexture") || document.texture.src;
  if (!original) {
    ui.notifications.error(game.i18n.localize("TOKEN_FLIP.Errors.NoOriginal"));
    return;
  }

  try {
    await document.update({
      "texture.src": choice.path,
      [`flags.${MODULE_ID}.originalTexture`]: original,
      [`flags.${MODULE_ID}.isAlternate`]: choice.alternateSlot !== null,
      [`flags.${MODULE_ID}.alternateSlot`]: choice.alternateSlot
    });
    ui.notifications.info(game.i18n.localize("TOKEN_FLIP.Notifications.Applied"));
  } catch (error) {
    console.error(`${MODULE_ID} | Could not switch token art`, error);
    ui.notifications.error(error.message ?? String(error));
  }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "permissions", {
    name: "TOKEN_FLIP.Settings.MenuName",
    label: "TOKEN_FLIP.Settings.MenuLabel",
    hint: "TOKEN_FLIP.Settings.MenuHint",
    icon: "fa-solid fa-circle-info",
    type: TokenFlipPermissions,
    restricted: false
  });
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControl = controls.tokens;
  if (!tokenControl?.tools) return;

  const setAlternate = {
    name: "tokenFlipSetAlternate",
    title: "TOKEN_FLIP.Controls.SetAlternate",
    icon: "fa-solid fa-images",
    button: true,
    visible: true,
    onChange: openAlternateArtPicker
  };
  const chooseArt = {
    name: "tokenFlipChooseArt",
    title: "TOKEN_FLIP.Controls.ChooseArt",
    icon: "fa-solid fa-images",
    button: true,
    visible: true,
    onChange: openTokenArtChoices
  };
  const order = Object.keys(tokenControl.tools).length;
  tokenControl.tools.tokenFlipSetAlternate = { ...setAlternate, order };
  tokenControl.tools.tokenFlipChooseArt = { ...chooseArt, order: order + 1 };
});
