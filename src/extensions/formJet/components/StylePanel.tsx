// A tervező Stílus füle: a form, a szekciók és a mezők stílusa, módonkénti felülírással.
// Csak a draft konfigurációt módosítja az onChange-en keresztül, immutábilisan.

import * as React from 'react';
import { IconButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { Slider } from '@fluentui/react/lib/Slider';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import {
  DEFAULT_GRADIENT_ANGLE,
  isFormWidth,
  isHexColor,
  MAX_BORDER_RADIUS,
  MAX_BORDER_WIDTH,
  MAX_FORM_WIDTH,
  MIN_FORM_WIDTH,
  normalizeHexColor,
  StyleScope
} from '../engine/FormStyle';
import { isTextElement } from '../engine/TextElement';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  GradientType,
  IBoxStyle,
  IFieldStyle,
  IFormConfig,
  IFormStyle,
  IGradient,
  IModeStyles,
  ISectionStyle
} from '../models/IFormConfig';
import { AccordionCard } from './AccordionCard';

const SCOPE_OPTIONS: IDropdownOption[] = [
  { key: 'base', text: strings.StyleScopeBase },
  { key: 'new', text: strings.ModeNew },
  { key: 'edit', text: strings.ModeEdit },
  { key: 'display', text: strings.ModeDisplay }
];

const INHERITED_OPTION: IDropdownOption = { key: '', text: strings.StyleInherited };

const DENSITY_OPTIONS: IDropdownOption[] = [
  INHERITED_OPTION,
  { key: 'comfortable', text: strings.StyleDensityComfortable },
  { key: 'compact', text: strings.StyleDensityCompact }
];

const SECTION_HEADER_OPTIONS: IDropdownOption[] = [
  INHERITED_OPTION,
  { key: 'underline', text: strings.StyleHeaderUnderline },
  { key: 'bar', text: strings.StyleHeaderBar },
  { key: 'plain', text: strings.StyleHeaderPlain }
];

const BACKGROUND_TYPE_OPTIONS: IDropdownOption[] = [
  { key: '', text: strings.StyleBgSolid },
  { key: 'linear', text: strings.StyleBgLinear },
  { key: 'radial', text: strings.StyleBgRadial }
];

/** Új színátmenet záró színe, amíg a szerkesztő nem választ mást. */
const DEFAULT_GRADIENT_END: string = '#c7e0f4';

const classes = mergeStyleSets({
  tab: { paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: 12, color: '#605e5c' },
  colorRow: { display: 'flex', alignItems: 'flex-start', gap: 4 },
  swatch: {
    width: 32,
    height: 32,
    padding: 0,
    border: '1px solid #605e5c',
    borderRadius: 2,
    background: 'none',
    cursor: 'pointer',
    flexShrink: 0
  },
  colorText: { flex: 1, minWidth: 0 }
});

/** Egy érvényességi kör (alap vagy mód) stílusának módosítása; az üres részek kimaradnak a JSON-ból. */
function patchModeStyle<T extends object>(
  styles: IModeStyles<T> | undefined,
  scope: StyleScope,
  patch: Partial<T>
): IModeStyles<T> | undefined {
  const merged: Record<string, unknown> = { ...((styles?.[scope] ?? {}) as object), ...(patch as object) };
  const scoped: Record<string, unknown> = {};
  Object.keys(merged).forEach((key) => {
    if (merged[key] !== undefined) {
      scoped[key] = merged[key];
    }
  });
  const next: IModeStyles<T> = { ...(styles ?? {}) };
  if (Object.keys(scoped).length > 0) {
    next[scope] = scoped as T;
  } else {
    delete next[scope];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

interface IValidatedFieldProps {
  label: string;
  /** A konfigurációban tárolt érték szövegként; üres, ha nincs megadva. */
  value: string;
  placeholder?: string;
  errorMessage: string;
  isValid: (text: string) => boolean;
  /** Csak érvényes vagy üres (undefined) értékkel hívódik. */
  onCommit: (text: string | undefined) => void;
  onRenderPrefix?: (text: string) => JSX.Element;
}

/** Szövegmező, amely gépelés közben érvénytelen is lehet; a konfigurációba csak érvényes érték kerül. */
const ValidatedField: React.FC<IValidatedFieldProps> = (props) => {
  const [text, setText] = React.useState<string>(props.value);

  // Kívülről változó érték (másik érvényességi kör, JSON fül, színválasztó): a szöveget hozzá igazítjuk.
  React.useEffect(() => {
    setText((current) => ((props.isValid(current) ? current : '') === props.value ? current : props.value));
  }, [props.value]);

  const onTextChange = (next: string): void => {
    const trimmed: string = next.trim();
    setText(next);
    if (trimmed === '') {
      props.onCommit(undefined);
    } else if (props.isValid(trimmed)) {
      props.onCommit(trimmed);
    }
  };

  const invalid: boolean = text.trim() !== '' && !props.isValid(text.trim());
  return (
    <div>
      <Label>{props.label}</Label>
      <div className={classes.colorRow}>
        {props.onRenderPrefix?.(text.trim())}
        <TextField
          className={classes.colorText}
          ariaLabel={props.label}
          value={text}
          placeholder={props.placeholder}
          errorMessage={invalid ? props.errorMessage : undefined}
          onChange={(_, next) => onTextChange(next ?? '')}
        />
        <IconButton
          iconProps={{ iconName: 'Clear' }}
          title={strings.StyleClear}
          ariaLabel={strings.StyleClear}
          disabled={text === ''}
          onClick={() => onTextChange('')}
        />
      </div>
    </div>
  );
};

interface IColorFieldProps {
  label: string;
  value: string | undefined;
  /** Az alapból örökölt érték, ha módonkénti beállítást szerkesztünk. */
  inherited?: string;
  onChange: (value: string | undefined) => void;
}

const ColorField: React.FC<IColorFieldProps> = (props) => (
  <ValidatedField
    label={props.label}
    value={props.value ?? ''}
    placeholder={props.inherited ? `${props.inherited} ${strings.StyleInherited}` : '#rrggbb'}
    errorMessage={strings.StyleInvalidColor}
    isValid={isHexColor}
    onCommit={props.onChange}
    onRenderPrefix={(text) => (
      <input
        type="color"
        className={classes.swatch}
        title={strings.StylePickColor}
        aria-label={`${props.label} – ${strings.StylePickColor}`}
        value={normalizeHexColor(isHexColor(text) ? text : props.inherited ?? '#ffffff')}
        onChange={(event) => props.onChange(event.target.value)}
      />
    )}
  />
);

interface INumberFieldProps {
  label: string;
  value: number | undefined;
  inherited?: number;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}

/** Egész szám adott tartományban. */
const NumberField: React.FC<INumberFieldProps> = (props) => (
  <ValidatedField
    label={props.label}
    value={props.value === undefined ? '' : String(props.value)}
    placeholder={props.inherited === undefined ? undefined : `${props.inherited} ${strings.StyleInherited}`}
    errorMessage={format(strings.StyleMaxWidthError, props.min, props.max)}
    isValid={(text) => /^\d+$/.test(text) && Number(text) >= props.min && Number(text) <= props.max}
    onCommit={(text) => props.onChange(text === undefined ? undefined : Number(text))}
  />
);

interface IBoxFieldsProps {
  style: IBoxStyle;
  /** Az alapból örökölt értékek, ha módonkénti beállítást szerkesztünk. */
  inherited: IBoxStyle;
  onChange: (patch: Partial<IBoxStyle>) => void;
}

/** Háttér (egyszínű vagy színátmenet) és keret; a formnál, a szekciónál és a mezőnél is ugyanez. */
const BoxFields: React.FC<IBoxFieldsProps> = (props) => {
  const { style, inherited } = props;
  const gradient: IGradient | undefined = style.backgroundGradient;

  const setGradientType = (type: GradientType | ''): void => {
    if (type === '') {
      props.onChange({ backgroundGradient: undefined });
      return;
    }
    const colors: [string, string] = gradient?.colors ?? [
      style.background ?? inherited.background ?? '#ffffff',
      DEFAULT_GRADIENT_END
    ];
    props.onChange({
      backgroundGradient: type === 'linear' ? { type, angle: gradient?.angle ?? DEFAULT_GRADIENT_ANGLE, colors } : { type, colors }
    });
  };

  // A színátmenethez mindkét szín kell, ezért a szín törlése itt nem érvényesül.
  const setGradientColor = (index: 0 | 1, color: string | undefined): void => {
    if (gradient && color) {
      const colors: [string, string] = [gradient.colors[0], gradient.colors[1]];
      colors[index] = color;
      props.onChange({ backgroundGradient: { ...gradient, colors } });
    }
  };

  return (
    <>
      <Dropdown
        label={strings.StyleBackgroundType}
        options={BACKGROUND_TYPE_OPTIONS}
        selectedKey={gradient?.type ?? ''}
        onChange={(_, option) => option && setGradientType(option.key as GradientType | '')}
      />
      {gradient ? (
        <>
          <ColorField
            label={strings.StyleGradientStart}
            value={gradient.colors[0]}
            onChange={(color) => setGradientColor(0, color)}
          />
          <ColorField
            label={strings.StyleGradientEnd}
            value={gradient.colors[1]}
            onChange={(color) => setGradientColor(1, color)}
          />
          {gradient.type === 'linear' && (
            <Slider
              label={strings.StyleGradientAngle}
              min={0}
              max={360}
              step={5}
              value={gradient.angle ?? DEFAULT_GRADIENT_ANGLE}
              onChange={(angle) => props.onChange({ backgroundGradient: { ...gradient, angle } })}
            />
          )}
        </>
      ) : (
        <>
          <ColorField
            label={strings.StyleBackground}
            value={style.background}
            inherited={inherited.background}
            onChange={(background) => props.onChange({ background })}
          />
          {inherited.backgroundGradient && style.background === undefined && (
            <div className={classes.hint}>{strings.StyleGradientInherited}</div>
          )}
        </>
      )}
      <ColorField
        label={strings.StyleBorderColor}
        value={style.borderColor}
        inherited={inherited.borderColor}
        onChange={(borderColor) => props.onChange({ borderColor })}
      />
      <NumberField
        label={strings.StyleBorderWidth}
        value={style.borderWidth}
        inherited={inherited.borderWidth}
        min={0}
        max={MAX_BORDER_WIDTH}
        onChange={(borderWidth) => props.onChange({ borderWidth })}
      />
      <NumberField
        label={strings.StyleBorderRadius}
        value={style.borderRadius}
        inherited={inherited.borderRadius}
        min={0}
        max={MAX_BORDER_RADIUS}
        onChange={(borderRadius) => props.onChange({ borderRadius })}
      />
    </>
  );
};

type StyleCard = 'form' | 'section' | 'field';

export interface IStylePanelProps {
  draft: IFormConfig;
  schema: IFieldSchema[];
  selectedField?: string;
  onSelectField: (name: string | undefined) => void;
  onChange: (draft: IFormConfig) => void;
}

export const StylePanel: React.FC<IStylePanelProps> = (props) => {
  const { draft, schema, selectedField } = props;
  const [scope, setScope] = React.useState<StyleScope>('base');
  // Egyszerre egy kártya van nyitva; alapból az első (a form).
  const [openCard, setOpenCard] = React.useState<StyleCard | undefined>('form');
  const toggleCard = (card: StyleCard): void => setOpenCard(openCard === card ? undefined : card);
  const [sectionId, setSectionId] = React.useState<string | undefined>(draft.sections[0]?.id);

  const sectionIndex: number = draft.sections.reduce((found, s, i) => (s.id === sectionId ? i : found), -1);
  const section = sectionIndex === -1 ? undefined : draft.sections[sectionIndex];
  const fieldSchema: IFieldSchema | undefined = schema.find((f) => f.InternalName === selectedField);

  // Az alapból örökölt érték csak módonkénti szerkesztésnél jelenik meg helykitöltőként.
  const inherited = <T extends object>(styles: IModeStyles<T> | undefined): T =>
    (scope === 'base' ? {} : styles?.base ?? {}) as T;

  const formStyle: IFormStyle = draft.style?.[scope] ?? {};
  const formBase: IFormStyle = inherited(draft.style);
  const setFormStyle = (patch: Partial<IFormStyle>): void => {
    const next: IFormConfig = { ...draft };
    const style = patchModeStyle(draft.style, scope, patch);
    if (style) {
      next.style = style;
    } else {
      delete next.style;
    }
    props.onChange(next);
  };

  const sectionStyle: ISectionStyle = section?.style?.[scope] ?? {};
  const sectionBase: ISectionStyle = inherited(section?.style);
  const setSectionStyle = (patch: Partial<ISectionStyle>): void => {
    if (!section) {
      return;
    }
    const nextSection = { ...section };
    const style = patchModeStyle(section.style, scope, patch);
    if (style) {
      nextSection.style = style;
    } else {
      delete nextSection.style;
    }
    const sections = draft.sections.slice();
    sections[sectionIndex] = nextSection;
    props.onChange({ ...draft, sections });
  };

  const fieldStyle: IFieldStyle = (selectedField && draft.fields[selectedField]?.style?.[scope]) || {};
  const fieldBase: IFieldStyle = inherited(selectedField ? draft.fields[selectedField]?.style : undefined);
  const setFieldStyle = (patch: Partial<IFieldStyle>): void => {
    if (!selectedField) {
      return;
    }
    const nextField = { ...(draft.fields[selectedField] ?? {}) };
    const style = patchModeStyle(nextField.style, scope, patch);
    if (style) {
      nextField.style = style;
    } else {
      delete nextField.style;
    }
    props.onChange({ ...draft, fields: { ...draft.fields, [selectedField]: nextField } });
  };

  return (
    <div className={classes.tab}>
      <Dropdown
        label={strings.StyleScope}
        options={SCOPE_OPTIONS}
        selectedKey={scope}
        onChange={(_, option) => option && setScope(option.key as StyleScope)}
      />
      <div className={classes.hint}>{strings.StyleScopeHint}</div>

      {/* A key miatt érvényességi kör váltásakor a mezők tiszta állapottal indulnak. */}
      <AccordionCard
        key={`form:${scope}`}
        title={strings.StyleForm}
        open={openCard === 'form'}
        onToggle={() => toggleCard('form')}
      >
        <ColorField
          label={strings.StyleAccentColor}
          value={formStyle.accentColor}
          inherited={formBase.accentColor}
          onChange={(accentColor) => setFormStyle({ accentColor })}
        />
        <BoxFields style={formStyle} inherited={formBase} onChange={setFormStyle} />
        <ValidatedField
          label={strings.StyleMaxWidth}
          value={formStyle.maxWidth === undefined ? '' : String(formStyle.maxWidth)}
          placeholder={formBase.maxWidth === undefined ? undefined : `${formBase.maxWidth} ${strings.StyleInherited}`}
          errorMessage={format(strings.StyleMaxWidthError, MIN_FORM_WIDTH, MAX_FORM_WIDTH)}
          isValid={(text) => /^\d+$/.test(text) && isFormWidth(Number(text))}
          onCommit={(text) => setFormStyle({ maxWidth: text === undefined ? undefined : Number(text) })}
        />
        <Dropdown
          label={strings.StyleDensity}
          options={DENSITY_OPTIONS}
          selectedKey={formStyle.density ?? ''}
          onChange={(_, option) =>
            option && setFormStyle({ density: option.key === '' ? undefined : (option.key as IFormStyle['density']) })
          }
        />
        <Dropdown
          label={strings.StyleSectionHeader}
          options={SECTION_HEADER_OPTIONS}
          selectedKey={formStyle.sectionHeader ?? ''}
          onChange={(_, option) =>
            option &&
            setFormStyle({ sectionHeader: option.key === '' ? undefined : (option.key as IFormStyle['sectionHeader']) })
          }
        />
      </AccordionCard>

      {draft.sections.length > 0 && (
        <AccordionCard
          key={`section:${scope}:${sectionId}`}
          title={strings.StyleSection}
          open={openCard === 'section'}
          onToggle={() => toggleCard('section')}
        >
          <Dropdown
            ariaLabel={strings.StyleSection}
            options={draft.sections.map((s) => ({ key: s.id, text: s.title || s.id }))}
            selectedKey={section?.id ?? null}
            onChange={(_, option) => option && setSectionId(String(option.key))}
          />
          {section && (
            <>
              <BoxFields style={sectionStyle} inherited={sectionBase} onChange={setSectionStyle} />
              <ColorField
                label={strings.StyleHeaderColor}
                value={sectionStyle.headerColor}
                inherited={sectionBase.headerColor}
                onChange={(headerColor) => setSectionStyle({ headerColor })}
              />
            </>
          )}
        </AccordionCard>
      )}

      <AccordionCard
        key={`field:${scope}:${selectedField}`}
        title={strings.Field}
        open={openCard === 'field'}
        onToggle={() => toggleCard('field')}
      >
        <Dropdown
          ariaLabel={strings.Field}
          placeholder={strings.FieldPickerPlaceholder}
          options={schema.map((f) => ({ key: f.InternalName, text: `${f.Title} (${f.InternalName})` }))}
          selectedKey={fieldSchema ? selectedField : null}
          onChange={(_, option) => props.onSelectField(option ? String(option.key) : undefined)}
        />
        {fieldSchema && (
          <>
            <BoxFields style={fieldStyle} inherited={fieldBase} onChange={setFieldStyle} />
            {/* A szövegelemnek nincs címkéje; ott a szöveg színe állítható. */}
            {isTextElement(fieldSchema) ? (
              <ColorField
                label={strings.StyleTextColor}
                value={fieldStyle.textColor}
                inherited={fieldBase.textColor}
                onChange={(textColor) => setFieldStyle({ textColor })}
              />
            ) : (
              <ColorField
                label={strings.StyleLabelColor}
                value={fieldStyle.labelColor}
                inherited={fieldBase.labelColor}
                onChange={(labelColor) => setFieldStyle({ labelColor })}
              />
            )}
          </>
        )}
      </AccordionCard>
    </div>
  );
};
