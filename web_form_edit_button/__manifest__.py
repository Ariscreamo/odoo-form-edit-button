{
    "name": "Form Edit Button",
    "summary": "Bring back the classic Edit button: form views open in readonly "
    "mode, the native cloud icon saves and returns to readonly.",
    "version": "19.0.1.0.0",
    "category": "Extra Tools",
    "author": "Henintsoa Ariel",
    "maintainer": "Henintsoa Ariel",
    "support": "henintsoaariel@gmail.com",
    "license": "LGPL-3",
    "depends": ["web"],
    "assets": {
        "web.assets_backend": [
            "web_form_edit_button/static/src/**/*",
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
