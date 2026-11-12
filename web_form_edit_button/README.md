# Form Edit Button (`web_form_edit_button`) for Odoo 18

Brings back the classic **Edit** button on Odoo 18 form views, without touching
the native save system or the cloud icon.

* Author: Henintsoa Ariel
* License: LGPL-3 (see `LICENSE`)
* Support: henintsoaariel@gmail.com

## Behavior

| Situation | Result |
|---|---|
| Open an existing record | **Read-only** form; clicking a field no longer edits it |
| Click **Edit** (or `Alt+A`) | Fields become editable |
| Click the **cloud** (or `Alt+S`) | Native save (validation, sync), then **back to read-only** |
| Click the **cross** (or `Alt+J`) | Native discard, then back to read-only |
| **New** button | The new record opens in edit mode; read-only after the cloud |
| **Duplicate** | The copy opens in edit mode |
| Action opened explicitly in edit mode (`flags: {'mode': 'edit'}`) | Opens in edit mode |
| Pager (next / previous) | Next record shown read-only (pending changes are auto-saved, as in standard) |
| Required field empty when clicking the cloud | Stays in edit mode and shows the error (standard) |

While editing, the cloud and the cross stay visible even without changes, so the
user can always leave edit mode. In read-only mode they stay hidden, as in standard.

### Unchanged

* Native auto-save: when leaving the view (breadcrumb, menu), switching browser tab,
  closing the page, before running an action button.
* Action buttons (header, smart buttons) work in read-only and edit mode; the
  current mode is kept.
* Forms opened **in a dialog**: wizards, quick create, one2many / many2many lines,
  "Create and edit".
* The **Settings** page (`res.config.settings`).
* Forms that are already read-only (`edit="0"`, insufficient access rights).
* Chatter (messages, notes, activities, attachments).
* Instant-save widgets (priority stars, clickable status bar…) remain usable in
  read-only mode, as in standard.

## Installation

1. Copy the `web_form_edit_button` folder into a directory of your `addons_path`.
2. Restart the Odoo server.
3. Activate the developer mode, then *Apps → Update Apps List*.
4. Search for "Form Edit Button" (remove the "Apps" filter) and activate it.

Command line: `odoo-bin -d <database> -i web_form_edit_button`

The module only depends on `web`, creates no data or table, and uninstalls cleanly.

## Keeping the standard behavior somewhere

* **One view**: add `edit_button="0"` to the `<form>` tag, e.g. in an inherited view:

  ```xml
  <xpath expr="/form" position="attributes">
      <attribute name="edit_button">0</attribute>
  </xpath>
  ```

* **One action**: add `'form_edit_button': False` to the action context.
* **JavaScript** (third-party module): override the `editButtonEnabled` getter of
  `FormController` (this is how the Settings page is excluded).

## Technical design

The module only relies on the native **record mode** mechanism
(`record.config.mode`: `"readonly"` / `"edit"`) of the Odoo 18 `RelationalModel`.

* `static/src/form_edit_button.js`: patches (`@web/core/utils/patch`) of
  * `FormController`: initial `readonly` mode, Edit button
    (`record.switchMode("edit")`), back to read-only after `saveButtonClicked` /
    `discard`, pager and "Duplicate" handling, "Edit Properties" from the cog menu;
  * `FormStatusIndicator` (cloud): only its **visibility** while editing is
    extended, its save logic is untouched;
  * `X2ManyField`: keeps `activeActions.edit` in sync with the record mode, so that
    editable list lines can be edited after clicking Edit;
  * `SettingsFormController`: Settings page excluded.
* `static/src/form_edit_button.xml`: inherits the `web.FormView` template to add
  the button before "New".
* `i18n/fr.po`: French translation ("Edit" → "Modifier").

No Odoo source file is modified.

## Tests

* `static/tests/form_edit_button.test.js`: 21 HOOT unit tests (read-only, Edit,
  cloud, cross, invalid record, editable x2many lines, new record, create="0", pager,
  duplicate, explicit edit mode,
  dialogs, `edit="0"`, opt-outs).
* `tests/test_ui.py`: real browser scenario on the Contacts form.

Run them: `odoo-bin -d <test_db> -i web_form_edit_button --test-tags /web_form_edit_button --stop-after-init`

> Note: this module intentionally changes the form behavior. Odoo's standard JS
> tests and tours that type directly into an existing record without clicking
> "Edit" will therefore fail on a database where this module is installed. This is
> expected: run those suites on a database without the module.
