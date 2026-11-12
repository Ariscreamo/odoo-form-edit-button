import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { press, queryAllTexts, queryFirst } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    defineModels,
    fields,
    models,
    mockService,
    mountView,
    mountViewInDialog,
    onRpc,
    toggleActionMenu,
    toggleMenuItem,
} from "@web/../tests/web_test_helpers";

class Partner extends models.Model {
    name = fields.Char();
    foo = fields.Char();
    _records = [
        { id: 1, name: "first record", foo: "yop" },
        { id: 2, name: "second record", foo: "blip" },
    ];
}

class Line extends models.Model {
    name = fields.Char();
    qty = fields.Float();
    _records = [{ id: 1, name: "line 1", qty: 1 }];
}

defineModels([Partner, Line]);

const ARCH = `
    <form>
        <header>
            <button name="do_something" type="object" string="Do something" class="o_do_something"/>
        </header>
        <sheet>
            <field name="name"/>
            <field name="foo"/>
        </sheet>
    </form>`;

const EDIT_BUTTON = ".o_control_panel .o_form_button_edit";
const STATUS_BUTTONS = ".o_form_status_indicator_buttons";
const FOO_INPUT = ".o_field_widget[name=foo] input";

describe.current.tags("desktop");

beforeEach(() => {
    onRpc("has_group", () => true);
});

test("an existing record opens in readonly mode with an Edit button", async () => {
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    expect(".o_form_readonly").toHaveCount(1);
    expect(".o_form_editable").toHaveCount(0);
    expect(EDIT_BUTTON).toHaveCount(1);
    expect(EDIT_BUTTON).toHaveText("Edit");
    expect(EDIT_BUTTON).toHaveAttribute("data-hotkey", "a");
    // l'icône nuage est toujours présente (mais masquée tant qu'on n'édite pas)
    expect(".o_form_status_indicator .o_form_button_save .fa-cloud-upload").toHaveCount(1);
    expect(`${STATUS_BUTTONS}.invisible`).toHaveCount(1);
    expect(FOO_INPUT).toHaveCount(0);
    expect(".o_field_widget[name=foo]").toHaveText("yop");
});

test("clicking a field in readonly mode does not switch to edition", async () => {
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await contains(".o_field_widget[name=foo]").click();
    await contains(".o_field_widget[name=name]").click();
    expect(".o_form_readonly").toHaveCount(1);
    expect(FOO_INPUT).toHaveCount(0);
});

test("Edit button switches to edition and the cloud saves then goes back to readonly", async () => {
    onRpc("web_save", ({ args }) => {
        expect.step("web_save");
        expect(args[1]).toEqual({ foo: "new value" });
    });
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await contains(EDIT_BUTTON).click();
    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
    expect(FOO_INPUT).toHaveCount(1);
    // nuage + croix visibles dès l'entrée en édition
    expect(`${STATUS_BUTTONS}:not(.invisible)`).toHaveCount(1);

    await contains(FOO_INPUT).edit("new value");
    await contains(".o_form_status_indicator .o_form_button_save").click();
    expect.verifySteps(["web_save"]);

    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(1);
    expect(`${STATUS_BUTTONS}.invisible`).toHaveCount(1);
    expect(".o_field_widget[name=foo]").toHaveText("new value");
});

test("Alt+A switches to edition", async () => {
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await press(["alt", "a"]);
    await animationFrame();
    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
});

test("clicking the cloud without changes goes back to readonly without saving", async () => {
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await contains(EDIT_BUTTON).click();
    expect(".o_form_editable").toHaveCount(1);
    await contains(".o_form_status_indicator .o_form_button_save").click();
    expect.verifySteps([]);
    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(1);
});

test("discard restores the values and goes back to readonly", async () => {
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await contains(EDIT_BUTTON).click();
    await contains(FOO_INPUT).edit("changed");
    await contains(".o_form_status_indicator .o_form_button_cancel").click();
    expect.verifySteps([]);
    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(1);
    expect(".o_field_widget[name=foo]").toHaveText("yop");
});

test("lines of an editable x2many list can be edited after clicking Edit", async () => {
    Partner._fields.line_ids = fields.One2many({ relation: "line" });
    Partner._records[0].line_ids = [1];
    onRpc("web_save", ({ args }) => {
        expect.step("web_save");
        expect(args[1]).toEqual({ line_ids: [[1, 1, { qty: 12 }]] });
    });
    await mountView({
        resModel: "partner",
        type: "form",
        arch: `
            <form>
                <field name="name"/>
                <field name="line_ids">
                    <list editable="bottom">
                        <field name="name"/>
                        <field name="qty"/>
                    </list>
                </field>
            </form>`,
        resId: 1,
    });

    expect(".o_field_x2many_list_row_add").toHaveCount(0);
    await contains(".o_data_row td[name=qty]").click();
    expect(".o_data_row td[name=qty] input").toHaveCount(0);

    await contains(EDIT_BUTTON).click();
    expect(".o_field_x2many_list_row_add").toHaveCount(1);
    await contains(".o_data_row td[name=qty]").click();
    expect(".o_selected_row td[name=qty] input").toHaveCount(1);
    await contains(".o_selected_row td[name=qty] input").edit("12", { confirm: "blur" });
    await contains(".o_form_status_indicator .o_form_button_save").click();
    expect.verifySteps(["web_save"]);
    expect(".o_form_readonly").toHaveCount(1);
    expect(".o_data_row td[name=qty]").toHaveText("12.00");
});

test("an invalid record stays in edition after clicking the cloud", async () => {
    Partner._fields.name = fields.Char({ required: true });
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await contains(EDIT_BUTTON).click();
    await contains(".o_field_widget[name=name] input").clear();
    await contains(".o_form_status_indicator .o_form_button_save").click();
    expect.verifySteps([]);
    expect(".o_form_editable").toHaveCount(1);
    expect(".o_field_widget[name=name]").toHaveClass("o_field_invalid");
});

test("a new record opens in edition and goes to readonly once saved", async () => {
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH });

    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
    await contains(".o_field_widget[name=name] input").edit("created");
    await contains(".o_form_status_indicator .o_form_button_save").click();
    expect.verifySteps(["web_save"]);
    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(1);
    expect(".o_field_widget[name=name]").toHaveText("created");
});

test("the New button opens an editable record from a readonly one", async () => {
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    expect(".o_form_readonly").toHaveCount(1);
    await contains(".o_control_panel .o_form_button_create").click();
    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
    expect(".o_field_widget[name=name] input").toHaveValue("");
});

test("Edit button is displayed before the New button", async () => {
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    expect(queryAllTexts(".o_control_panel_main_buttons button")).toEqual(["Edit", "New"]);
    const editRect = queryFirst(EDIT_BUTTON).getBoundingClientRect();
    const newRect = queryFirst(".o_control_panel .o_form_button_create").getBoundingClientRect();
    expect(editRect.left).toBeLessThan(newRect.left);
});

test("Edit button is displayed even without the create right (create='0')", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        arch: `<form create="0"><field name="foo"/></form>`,
        resId: 1,
    });

    expect(".o_control_panel .o_form_button_create").toHaveCount(0);
    expect(EDIT_BUTTON).toHaveCount(1);
    await contains(EDIT_BUTTON).click();
    expect(".o_form_editable").toHaveCount(1);
});

test("navigating with the pager goes back to readonly", async () => {
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1, resIds: [1, 2] });

    await contains(EDIT_BUTTON).click();
    expect(".o_form_editable").toHaveCount(1);
    await contains(".o_pager_next").click();
    expect(".o_field_widget[name=foo]").toHaveText("blip");
    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(1);
});

test("navigating with the pager from a dirty record saves it (native) then shows the next one readonly", async () => {
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1, resIds: [1, 2] });

    await contains(EDIT_BUTTON).click();
    await contains(FOO_INPUT).edit("changed");
    await contains(".o_pager_next").click();
    expect.verifySteps(["web_save"]);
    expect(".o_field_widget[name=foo]").toHaveText("blip");
    expect(".o_form_readonly").toHaveCount(1);

    await contains(".o_pager_previous").click();
    expect(".o_field_widget[name=foo]").toHaveText("changed");
    expect(".o_form_readonly").toHaveCount(1);
});

test("duplicating a record opens the copy in edition", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        arch: ARCH,
        resId: 1,
        actionMenus: {},
    });

    expect(".o_form_readonly").toHaveCount(1);
    await toggleActionMenu();
    await toggleMenuItem("Duplicate");
    expect(".o_breadcrumb").toHaveText("first record (copy)");
    expect(".o_form_editable").toHaveCount(1);
});

test("header buttons still work in readonly mode and keep it", async () => {
    mockService("action", {
        doActionButton(params) {
            expect.step(params.name);
        },
    });
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    await contains(".o_do_something").click();
    expect.verifySteps(["do_something"]);
    expect(".o_form_readonly").toHaveCount(1);
});

test("forms opened in a dialog keep the native behaviour", async () => {
    await mountViewInDialog({ resModel: "partner", type: "form", arch: ARCH, resId: 1 });

    expect(".modal .o_form_editable").toHaveCount(1);
    expect(".modal .o_form_button_edit").toHaveCount(0);
});

test("forms with edit='0' keep the native readonly behaviour (no Edit button)", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        arch: `<form edit="0"><field name="foo"/></form>`,
        resId: 1,
    });

    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
});

test("edit_button='0' on the form arch disables the feature for that view", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        arch: `<form edit_button="0"><field name="foo"/></form>`,
        resId: 1,
    });

    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
});

test("an explicit mode='edit' (action flags) opens the record in edition", async () => {
    onRpc("web_save", () => expect.step("web_save"));
    await mountView({ resModel: "partner", type: "form", arch: ARCH, resId: 1, mode: "edit" });

    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
    await contains(FOO_INPUT).edit("changed");
    await contains(".o_form_status_indicator .o_form_button_save").click();
    expect.verifySteps(["web_save"]);
    expect(".o_form_readonly").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(1);
});

test("context key form_edit_button=False disables the feature", async () => {
    await mountView({
        resModel: "partner",
        type: "form",
        arch: ARCH,
        resId: 1,
        context: { form_edit_button: false },
    });

    expect(".o_form_editable").toHaveCount(1);
    expect(EDIT_BUTTON).toHaveCount(0);
});
