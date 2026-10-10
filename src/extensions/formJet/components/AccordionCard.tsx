// Becsukható kártya a tervező füleihez. A nyitott állapotot a szülő tartja, így egyszerre csak egy lehet nyitva.

import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

const classes = mergeStyleSets({
  card: { border: '1px solid #edebe9', borderRadius: 4 },
  header: { display: 'flex', alignItems: 'center', gap: 4, paddingRight: 4 },
  toggle: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    border: 'none',
    background: 'none',
    font: 'inherit',
    fontWeight: 600,
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer'
  },
  title: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  body: { padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }
});

export interface IAccordionCardProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** A fejléc jobb oldalán megjelenő gombok; csukott állapotban is látszanak. */
  actions?: React.ReactNode;
}

export const AccordionCard: React.FC<IAccordionCardProps> = (props) => (
  <div className={classes.card}>
    <div className={classes.header}>
      <button type="button" className={classes.toggle} aria-expanded={props.open} onClick={props.onToggle}>
        <Icon iconName={props.open ? 'ChevronDown' : 'ChevronRight'} />
        <span className={classes.title}>{props.title}</span>
      </button>
      {props.actions}
    </div>
    {props.open && <div className={classes.body}>{props.children}</div>}
  </div>
);
