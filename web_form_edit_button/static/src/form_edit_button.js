import { onWillUpdateProps, status, useEffect } from "@odoo/owl";
import { getTemplate } from "@web/core/templates";
import { patch } from "@web/core/utils/patch";
import { exprToBoolean } from "@web/core/utils/strings";
import { X2ManyField } from "@web/views/fields/x2many/x2many_field";
import { FormController } from "@web/views/form/form_controller";
import { FormStatusIndicator } from "@web/views/form/form_status_indicator/form_status_indicator";
import { SettingsFormController } from "@web/webclient/settings_form_view/settings_form_controller";

/**
 * Réintroduit le bouton « Modifier » sur les vues formulaire.
 *
 * Le principe s'appuie uniquement sur le mécanisme natif de mode de
 * l'enregistrement (`record.config.mode` : "readonly" | "edit") déjà géré
 * par le RelationalModel d'Odoo 19 :
 *  - le formulaire est chargé en mode "readonly" (le modèle force lui-même
 *    le mode "edit" pour un nouvel enregistrement) ;
 *  - le bouton « Modifier » appelle `record.switchMode("edit")` ;
 *  - l'icône nuage (FormStatusIndicator) appelle toujours la sauvegarde
 *    native ; une fois la sauvegarde réussie, on repasse en "readonly" ;
 *  - la croix (annuler) appelle toujours l'annulation native, puis on
 *    repasse en "readonly".
 *
 * Le système de sauvegarde (auto-save en quittant la vue, au changement
 * d'onglet, à la fermeture de la page, avant un bouton d'action…) n'est pas
 * modifié.
 */

/** Attribut d'arch pour désactiver le bouton sur une vue : <form edit_button="0"> */
export const EDIT_BUTTON_ARCH_ATTRIBUTE = "edit_button";
/** Clé de contexte pour le désactiver sur une action : {'form_edit_button': False} */
export const EDIT_BUTTON_CONTEXT_KEY = "form_edit_button";

patch(FormController.prototype, {
    setup() {
        // Initialisés avant super.setup() : le modèle est créé (et ses hooks
        // branchés) pendant super.setup().
        this._formEditButtonLastResId = undefined;
        this._formEditButtonForceEdit = false;
        this._formEditButtonAfterEdit = null;
        super.setup(...arguments);

        if (this.editButtonEnabled) {
            // Exécute une action différée qui nécessitait le mode édition
            // (ex. « Modifier les propriétés » du menu engrenage), une fois que
            // le formulaire a été re-rendu en mode édition.
            useEffect(
                (isInEdition) => {
                    if (isInEdition && this._formEditButtonAfterEdit) {
                        const callback = this._formEditButtonAfterEdit;
                        this._formEditButtonAfterEdit = null;
                        callback();
                    }
                },
                () => [this.model.root.isInEdition]
            );
        }
    },

    /**
     * Le bouton « Modifier » n'est actif que pour les formulaires « pleine
     * page » éditables. Il est désactivé :
     *  - dans les dialogues (assistants, création rapide, lignes x2many…) ;
     *  - si la vue n'affiche pas de barre de contrôle ;
     *  - si le formulaire est déjà en lecture seule nativement
     *    (edit="0", droits, prop readonly/preventEdit) ;
     *  - si la vue porte edit_button="0" ou l'action le contexte
     *    {'form_edit_button': False}.
     *
     * Les modules tiers peuvent surcharger ce getter pour l'adapter.
     *
     * @returns {boolean}
     */
    get editButtonEnabled() {
        if (!this.canEdit || this.props.readonly || this.env.inDialog) {
            return false;
        }
        if (!this.display?.controlPanel) {
            return false;
        }
        if (!this._formEditButtonInTemplate) {
            // Sécurité : si la vue utilise un template qui n'affiche pas le
            // bouton « Modifier », on garde le fonctionnement natif plutôt que
            // de bloquer le formulaire en lecture seule.
            return false;
        }
        const archValue = this.archInfo.xmlDoc.getAttribute(EDIT_BUTTON_ARCH_ATTRIBUTE);
        if (archValue !== null && !exprToBoolean(archValue)) {
            return false;
        }
        if (this.props.context?.[EDIT_BUTTON_CONTEXT_KEY] === false) {
            return false;
        }
        return true;
    },

    /**
     * Vrai si le template utilisé par ce formulaire contient le bouton
     * « Modifier » (calculé une seule fois). Un template inconnu n'est pas
     * bloquant.
     */
    get _formEditButtonInTemplate() {
        if (this.__formEditButtonInTemplate === undefined) {
            let found = true;
            try {
                const template = getTemplate(this.constructor.template);
                if (template && typeof template.querySelector === "function") {
                    found = Boolean(template.querySelector("[class~='o_form_button_edit']"));
                }
            } catch {
                found = true;
            }
            this.__formEditButtonInTemplate = found;
        }
        return this.__formEditButtonInTemplate;
    },

    get modelParams() {
        const params = super.modelParams;
        if (this.editButtonEnabled) {
            // Le RelationalModel force de lui-même "edit" pour un nouvel
            // enregistrement (resId = false).
            params.config.mode = "readonly";
        }
        return params;
    },

    /**
     * Appelé par le modèle avant chaque (re)chargement de l'enregistrement
     * racine. Quand on passe à un AUTRE enregistrement existant (pager,
     * suppression puis affichage du suivant…), le formulaire revient en
     * lecture seule. Le passage d'un nouvel enregistrement à sa version
     * sauvegardée ne change pas le mode.
     */
    onWillLoadRoot(config) {
        super.onWillLoadRoot(...arguments);
        if (!config || !this.editButtonEnabled) {
            return;
        }
        const { resId } = config;
        if (this._formEditButtonForceEdit) {
            this._formEditButtonForceEdit = false;
            config.mode = "edit";
        } else if (resId && this._formEditButtonLastResId && resId !== this._formEditButtonLastResId) {
            config.mode = "readonly";
        }
        this._formEditButtonLastResId = resId;
    },

    /**
     * Clic sur « Modifier ».
     */
    async onFormEditButtonClicked() {
        await this.model.root.switchMode("edit");
    },

    /**
     * Repasse en lecture seule si le formulaire est en édition sur un
     * enregistrement existant.
     */
    async _formEditButtonLeaveEdition() {
        if (!this.editButtonEnabled || status(this) === "destroyed") {
            return;
        }
        const root = this.model.root;
        if (!root.isNew && root.isInEdition) {
            await root.switchMode("readonly");
        }
    },

    /**
     * Icône nuage : sauvegarde native inchangée, puis retour en lecture seule
     * si la sauvegarde a réussi.
     */
    async saveButtonClicked() {
        const saved = await super.saveButtonClicked(...arguments);
        if (saved) {
            await this._formEditButtonLeaveEdition();
        }
        return saved;
    },

    /**
     * Croix : annulation native inchangée, puis retour en lecture seule.
     */
    async discard() {
        await super.discard(...arguments);
        await this._formEditButtonLeaveEdition();
    },

    /**
     * « Dupliquer » ouvre la copie en mode édition, comme dans les versions
     * classiques d'Odoo.
     */
    async duplicateRecord() {
        this._formEditButtonForceEdit = this.editButtonEnabled;
        try {
            return await super.duplicateRecord(...arguments);
        } finally {
            this._formEditButtonForceEdit = false;
        }
    },

    /**
     * « Modifier les propriétés » (menu engrenage) a besoin du mode édition :
     * on y passe d'abord, puis on déclenche l'action d'origine.
     */
    getStaticActionMenuItems() {
        const items = super.getStaticActionMenuItems(...arguments);
        const propertyItem = items.addPropertyFieldValue;
        if (propertyItem && this.editButtonEnabled) {
            const originalCallback = propertyItem.callback;
            propertyItem.callback = (...args) => {
                if (this.model.root.isInEdition) {
                    return originalCallback(...args);
                }
                this._formEditButtonAfterEdit = () => originalCallback(...args);
                return this.model.root.switchMode("edit");
            };
        }
        return items;
    },
});

/**
 * Indicateur de sauvegarde (nuage + croix) : en mode « bouton Modifier », ses
 * boutons restent visibles tant que le formulaire est en édition, même sans
 * modification, pour pouvoir sauvegarder/quitter l'édition. Le reste de son
 * fonctionnement (états, validation, raccourcis) est inchangé.
 */
patch(FormStatusIndicator, {
    props: {
        ...FormStatusIndicator.props,
        showButtonsInEdition: { type: Boolean, optional: true },
    },
});

patch(FormStatusIndicator.prototype, {
    get displayButtons() {
        return (
            super.displayButtons ||
            Boolean(this.props.showButtonsInEdition && this.props.model.root.isInEdition)
        );
    },
});

/**
 * Champs one2many / many2many : Odoo fige `activeActions.edit` au montage du
 * champ (valeur de `record.isInEdition` à cet instant). Nativement le
 * formulaire ne passe jamais de la lecture seule à l'édition sans être
 * remonté ; avec le bouton « Modifier », si. On garde donc cette valeur
 * synchronisée avec le mode courant de l'enregistrement, sinon les lignes
 * d'une liste éditable resteraient en lecture seule après « Modifier ».
 */
patch(X2ManyField.prototype, {
    setup() {
        super.setup(...arguments);
        onWillUpdateProps((nextProps) => {
            this.activeActions.edit = nextProps.record.isInEdition;
        });
    },
});

/**
 * La vue Paramètres (res.config.settings) garde son fonctionnement natif.
 */
patch(SettingsFormController.prototype, {
    get editButtonEnabled() {
        return false;
    },
});
