from odoo.tests import HttpCase, tagged

# Scénario exécuté dans un vrai navigateur sur le formulaire standard des
# contacts : lecture seule -> « Modifier » -> saisie -> nuage -> lecture seule.
PARTNER_FORM_SCENARIO = r"""
(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const fail = (msg) => {
        console.error("[web_form_edit_button] " + msg);
        throw new Error(msg);
    };
    const waitFor = async (selector, timeout = 15000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) {
                return el;
            }
            await sleep(50);
        }
        fail(`timeout while waiting for "${selector}"`);
    };
    const expectNone = (selector) => {
        if (document.querySelector(selector)) {
            fail(`"${selector}" should not be present`);
        }
    };

    // 1. ouverture : lecture seule, bouton Modifier, pas de champ de saisie
    await waitFor(".o_form_view .o_form_readonly");
    await waitFor(".o_control_panel .o_form_button_edit");
    expectNone(".o_field_widget[name=function] input");
    await waitFor(".o_form_status_indicator .o_form_button_save [data-icon=cloud_upload]");
    await waitFor(".o_form_status_indicator_buttons.invisible");

    // 2. un clic sur un champ ne passe pas en édition
    (await waitFor(".o_field_widget[name=function]")).click();
    await sleep(300);
    await waitFor(".o_form_view .o_form_readonly");
    expectNone(".o_field_widget[name=function] input");

    // 3. clic sur Modifier : édition
    (await waitFor(".o_control_panel .o_form_button_edit")).click();
    await waitFor(".o_form_view .o_form_editable");
    expectNone(".o_control_panel .o_form_button_edit");
    await waitFor(".o_form_status_indicator_buttons:not(.invisible)");
    const input = await waitFor(".o_field_widget[name=function] input");
    input.value = "After";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(100);

    // 4. clic sur le nuage : sauvegarde native puis retour en lecture seule
    (await waitFor(".o_form_status_indicator .o_form_button_save")).click();
    await waitFor(".o_form_view .o_form_readonly");
    await waitFor(".o_control_panel .o_form_button_edit");
    const fieldText = (await waitFor(".o_field_widget[name=function]")).textContent.trim();
    if (fieldText !== "After") {
        fail(`unexpected value after save: "${fieldText}"`);
    }
    console.log("test successful");
})();
"""


@tagged("post_install", "-at_install")
class TestFormEditButtonUi(HttpCase):
    def test_partner_form_edit_then_save_with_cloud(self):
        partner = self.env["res.partner"].create({
            "name": "Edit Button Partner",
            "function": "Before",
        })
        action = self.env.ref("base.action_partner_form")
        self.browser_js(
            f"/odoo/action-{action.id}/{partner.id}",
            PARTNER_FORM_SCENARIO,
            login="admin",
            timeout=120,
        )
        partner.invalidate_recordset()
        self.assertEqual(partner.function, "After")
