{
    "name": "Form Edit Button",
    "summary": "Bring back the classic Edit button: form views open in readonly "
    "mode, the native cloud icon saves and returns to readonly.",
    "version": "18.0.1.0.1",
    "category": "Extra Tools",
    "author": "Henintsoa Ariel",
    "maintainer": "Henintsoa Ariel",
    "support": "henintsoaariel@gmail.com",
    "license": "LGPL-3",
    "depends": ["web"],
    "assets": {
        "web.assets_backend": [
            # Placé juste après les templates du formulaire d'Odoo : les vues
            # qui copient ces templates (Projet, Tâches, To-do, Ventes…) reçoivent
            # ainsi aussi le bouton « Modifier », quel que soit l'ordre des modules.
            (
                "after",
                "web/static/src/views/form/form_controller.xml",
                "web_form_edit_button/static/src/form_edit_button.xml",
            ),
            "web_form_edit_button/static/src/form_edit_button.js",
        ],
        "web.assets_unit_tests": [
            "web_form_edit_button/static/tests/**/*",
        ],
    },
    "images": ["static/description/banner.png"],
    "installable": True,
    "application": False,
    "auto_install": False,
}
