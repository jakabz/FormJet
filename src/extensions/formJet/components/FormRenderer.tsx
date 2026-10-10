// Szekciók és rács. A felhasználói form és a tervező előnézete is ezt használja.

import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { mergeStyles, mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { IResolvedField, IResolvedForm, IResolvedSection } from '../engine/LayoutResolver';
import { FieldErrors, FormValues } from '../models/IFieldSchema';
import { FieldRenderer } from './FieldRenderer';

const NARROW_SCREEN: string = '@media (max-width: 640px)';

const classes = mergeStyleSets({
  section: { marginBottom: 24 },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '0 0 6px',
    margin: '0 0 12px',
    border: 'none',
    borderBottom: '1px solid #edebe9',
    background: 'none',
    font: 'inherit',
    fontSize: 16,
    fontWeight: 600,
    color: 'inherit',
    textAlign: 'left'
  },
  sectionHeaderButton: { cursor: 'pointer' },
  sectionDescription: { fontSize: 12, color: '#605e5c', margin: '-6px 0 12px' },
  hidden: { opacity: 0.45 },
  hiddenTag: { fontSize: 11, fontWeight: 400, color: '#605e5c' },
  clickable: { cursor: 'pointer', borderRadius: 2, outlineOffset: 4, selectors: { ':hover': { outline: '1px dashed #c8c6c4' } } },
  selected: { outline: '2px solid #0078d4', outlineOffset: 4, borderRadius: 2 }
});

function gridClass(columns: number): string {
  return mergeStyles({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: '12px 20px',
    selectors: { [NARROW_SCREEN]: { gridTemplateColumns: 'minmax(0, 1fr)' } }
  });
}

function cellClass(colSpan: number): string {
  return mergeStyles({
    gridColumn: `span ${colSpan}`,
    minWidth: 0,
    selectors: { [NARROW_SCREEN]: { gridColumn: '1 / -1' } }
  });
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
}

export const FormRenderer: React.FC<IFormRendererProps> = (props) => {
  const { form, showHidden } = props;
  // A felhasználó által átváltott szekciók; a többi a konfiguráció szerinti állapotban van.
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});

  const renderField = (section: IResolvedSection, field: IResolvedField): JSX.Element | undefined => {
    if (!field.visible && !showHidden) {
      return undefined;
    }
    const classNames: string[] = [cellClass(field.colSpan)];
    // Rejtett szekcióban a szekció már halvány, a mezőt nem halványítjuk még egyszer.
    if (!field.visible && section.visible) {
      classNames.push(classes.hidden);
    }
    if (props.onFieldSelect) {
      classNames.push(props.selectedField === field.name ? classes.selected : classes.clickable);
    }
    return (
      <div
        key={field.name}
        className={classNames.join(' ')}
        onClick={props.onFieldSelect ? () => props.onFieldSelect?.(field.name) : undefined}
      >
        <FieldRenderer
          field={field}
          value={props.values[field.name] ?? ''}
          displayValue={props.displayValues?.[field.name]}
          error={props.errors[field.name]}
          onChange={props.onChange}
        />
      </div>
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

    let header: JSX.Element | undefined;
    if (section.collapsible) {
      header = (
        <button
          type="button"
          className={`${classes.sectionHeader} ${classes.sectionHeaderButton}`}
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
        <div className={classes.sectionHeader} role="heading" aria-level={2}>
          <span>{section.title}</span>
          {hiddenTag}
        </div>
      );
    }

    return (
      <div key={section.id} className={`${classes.section} ${section.visible ? '' : classes.hidden}`}>
        {header}
        {!collapsed && section.description && <div className={classes.sectionDescription}>{section.description}</div>}
        {!collapsed && (
          <div className={gridClass(section.columns)}>{section.fields.map((field) => renderField(section, field))}</div>
        )}
      </div>
    );
  };

  return <div>{form.sections.map(renderSection)}</div>;
};
