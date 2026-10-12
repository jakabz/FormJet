// Szekciók és rács. A felhasználói form és a tervező előnézete is ezt használja.

import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { IStyle, mergeStyles, mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { backgroundCss, contrastTextColor, hasBox } from '../engine/FormStyle';
import { IResolvedField, IResolvedForm, IResolvedSection } from '../engine/LayoutResolver';
import { FieldErrors, FormValues } from '../models/IFieldSchema';
import { Density, IBoxStyle, IFieldStyle, IFormStyle, ISectionStyle } from '../models/IFormConfig';
import { FieldRenderer } from './FieldRenderer';
import { RelatedItems } from './RelatedItems';

const NARROW_SCREEN: string = '@media (max-width: 640px)';

const DEFAULT_BORDER: string = '#edebe9';
const DEFAULT_RADIUS: number = 4;

const classes = mergeStyleSets({
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    // A belső margó (pl. a színes sávos fejlécnél) a szélességbe számítson, különben a fejléc kilóg.
    boxSizing: 'border-box',
    padding: '0 0 6px',
    margin: '0 0 12px',
    border: 'none',
    background: 'none',
    font: 'inherit',
    fontSize: 16,
    fontWeight: 600,
    color: 'inherit',
    textAlign: 'left'
  },
  sectionHeaderButton: { cursor: 'pointer' },
  sectionDescription: { fontSize: 12, color: '#605e5c', margin: '-6px 0 12px' },
  related: { marginTop: 8 },
  hidden: { opacity: 0.45 },
  hiddenTag: { fontSize: 11, fontWeight: 400, color: '#605e5c' },
  clickable: { cursor: 'pointer', borderRadius: 2, outlineOffset: 4, selectors: { ':hover': { outline: '1px dashed #c8c6c4' } } },
  selected: { outline: '2px solid #0078d4', outlineOffset: 4, borderRadius: 2 }
});

// A stílusból képzett osztályok. A mergeStyles azonos tartalomra ugyanazt az osztályt adja vissza.

/** Háttér és keret. Ha az elemnek látható háttere vagy kerete van, belső margót is kap. */
function boxStyle(style: IBoxStyle, padding: number): IStyle {
  if (!hasBox(style)) {
    return undefined;
  }
  const borderWidth: number = style.borderWidth ?? (style.borderColor ? 1 : 0);
  return {
    background: backgroundCss(style),
    border: borderWidth > 0 ? `${borderWidth}px solid ${style.borderColor ?? DEFAULT_BORDER}` : undefined,
    borderRadius: style.borderRadius ?? DEFAULT_RADIUS,
    padding
  };
}

function formClass(style: IFormStyle): string {
  return mergeStyles({ maxWidth: style.maxWidth }, boxStyle(style, 16));
}

function sectionClass(style: ISectionStyle, density: Density | undefined): string {
  return mergeStyles({ marginBottom: density === 'compact' ? 16 : 24 }, boxStyle(style, 16));
}

function sectionHeaderClass(form: IFormStyle, section: ISectionStyle): string {
  const color: string | undefined = section.headerColor ?? form.accentColor;
  switch (form.sectionHeader) {
    case 'bar': {
      const background: string = color ?? '#f3f2f1';
      return mergeStyles({ background, color: contrastTextColor(background), padding: '6px 10px', borderRadius: 2 });
    }
    case 'plain':
      return mergeStyles({ color });
    default:
      return mergeStyles({ color, borderBottom: color ? `2px solid ${color}` : `1px solid ${DEFAULT_BORDER}` });
  }
}

function gridClass(columns: number, density: Density | undefined): string {
  return mergeStyles({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: density === 'compact' ? '6px 16px' : '12px 20px',
    selectors: { [NARROW_SCREEN]: { gridTemplateColumns: 'minmax(0, 1fr)' } }
  });
}

function cellClass(colSpan: number, style: IFieldStyle): string {
  return mergeStyles(
    {
      gridColumn: `span ${colSpan}`,
      minWidth: 0,
      selectors: { [NARROW_SCREEN]: { gridColumn: '1 / -1' } }
    },
    boxStyle(style, 8),
    style.textColor ? { color: style.textColor } : undefined,
    style.labelColor ? { selectors: { '& .ms-Label': { color: style.labelColor } } } : undefined
  );
}

/** Egy becsomagolható elem tulajdonságai: a renderelő ezeket tenné a saját `div`-jére. */
export interface ISlotProps {
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
  'data-section'?: string;
  'data-field'?: string;
}

/**
 * A tervező ezeken keresztül csomagolja be a szekciókat, a rácsot és a cellákat (húzd-és-ejtsd).
 * A visszaadott elemnek a kapott tulajdonságokat a saját gyökerére kell tennie, így az elrendezés
 * és a megjelenés ugyanaz marad, mint a felhasználói formon.
 */
export interface IFormRendererSlots {
  renderSection?: (section: IResolvedSection, slot: ISlotProps) => JSX.Element;
  /** Üres szekciónál is meghívódik, hogy a szekcióba mezőt lehessen ejteni. */
  renderGrid?: (section: IResolvedSection, slot: ISlotProps) => JSX.Element;
  renderCell?: (section: IResolvedSection, field: IResolvedField, slot: ISlotProps) => JSX.Element;
}

export interface IFormRendererProps {
  form: IResolvedForm;
  values: FormValues;
  displayValues?: FormValues;
  errors: FieldErrors;
  onChange: (name: string, value: string) => void;
  /** Tervező előnézet: a rejtett szekciók és mezők halványan látszanak. */
  showHidden?: boolean;
  /** Tervező előnézet: a kijelölt mező. */
  selectedField?: string;
  onFieldSelect?: (name: string) => void;
  /** Csak a tervező adja meg. */
  slots?: IFormRendererSlots;
}

export const FormRenderer: React.FC<IFormRendererProps> = (props) => {
  const { form, showHidden, slots } = props;
  // A felhasználó által átváltott szekciók; a többi a konfiguráció szerinti állapotban van.
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});

  const renderField = (section: IResolvedSection, field: IResolvedField): JSX.Element | undefined => {
    if (!field.visible && !showHidden) {
      return undefined;
    }
    const classNames: string[] = [cellClass(field.colSpan, field.style)];
    // Rejtett szekcióban a szekció már halvány, a mezőt nem halványítjuk még egyszer.
    if (!field.visible && section.visible) {
      classNames.push(classes.hidden);
    }
    if (props.onFieldSelect) {
      classNames.push(props.selectedField === field.name ? classes.selected : classes.clickable);
    }
    const slot: ISlotProps = {
      'data-field': field.name,
      className: classNames.join(' '),
      onClick: props.onFieldSelect ? () => props.onFieldSelect?.(field.name) : undefined,
      children: (
        <FieldRenderer
          field={field}
          value={props.values[field.name] ?? ''}
          displayValue={props.displayValues?.[field.name]}
          error={props.errors[field.name]}
          onChange={props.onChange}
        />
      )
    };
    return slots?.renderCell ? (
      <React.Fragment key={field.name}>{slots.renderCell(section, field, slot)}</React.Fragment>
    ) : (
      <div key={field.name} {...slot} />
    );
  };

  const renderSection = (section: IResolvedSection): JSX.Element | undefined => {
    if (!section.visible && !showHidden) {
      return undefined;
    }
    const collapsed: boolean = section.collapsible && (toggled[section.id] ? !section.collapsed : section.collapsed);
    const hiddenTag: JSX.Element | undefined = section.visible ? undefined : (
      <span className={classes.hiddenTag}>{strings.HiddenTag}</span>
    );

    const headerClass: string = sectionHeaderClass(form.style, section.style);

    let header: JSX.Element | undefined;
    if (section.collapsible) {
      header = (
        <button
          type="button"
          className={`${classes.sectionHeader} ${headerClass} ${classes.sectionHeaderButton}`}
          aria-expanded={!collapsed}
          onClick={() => setToggled({ ...toggled, [section.id]: !toggled[section.id] })}
        >
          <Icon iconName={collapsed ? 'ChevronRight' : 'ChevronDown'} />
          <span>{section.title}</span>
          {hiddenTag}
        </button>
      );
    } else if (section.title || hiddenTag) {
      header = (
        <div className={`${classes.sectionHeader} ${headerClass}`} role="heading" aria-level={2}>
          <span>{section.title}</span>
          {hiddenTag}
        </div>
      );
    }

    const gridSlot: ISlotProps = {
      className: gridClass(section.columns, form.style.density),
      children: section.fields.map((field) => renderField(section, field))
    };
    let grid: JSX.Element | undefined;
    if (!collapsed && slots?.renderGrid) {
      grid = slots.renderGrid(section, gridSlot);
    } else if (!collapsed && section.fields.length > 0) {
      grid = <div {...gridSlot} />;
    }

    const sectionSlot: ISlotProps = {
      'data-section': section.id,
      className: `${sectionClass(section.style, form.style.density)} ${section.visible ? '' : classes.hidden}`,
      children: (
        <>
          {header}
          {!collapsed && section.description && <div className={classes.sectionDescription}>{section.description}</div>}
          {grid}
          {!collapsed && section.related && (
            <div className={classes.related}>
              <RelatedItems config={section.related} designing={showHidden} />
            </div>
          )}
        </>
      )
    };
    return slots?.renderSection ? (
      <React.Fragment key={section.id}>{slots.renderSection(section, sectionSlot)}</React.Fragment>
    ) : (
      <div key={section.id} {...sectionSlot} />
    );
  };

  // A data- attribútumok stabil kapaszkodók (mód, szekció, mező) a későbbi egyedi stílusokhoz.
  return (
    <div data-formjet-mode={form.mode} className={formClass(form.style)}>
      {form.sections.map(renderSection)}
    </div>
  );
};
