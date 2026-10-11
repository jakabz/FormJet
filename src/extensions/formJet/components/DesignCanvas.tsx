// A tervező húzd-és-ejtsd felülete: az előnézeten a szekciók és a mezők a fogantyújuknál fogva áthelyezhetők,
// a még el nem helyezett mezők pedig a tervező paneljéről húzhatók be egy szekcióba.
// Ugyanazt a FormRenderer-t használja, mint a felhasználói form; csak a szekciókat és a rácscellákat csomagolja be.
// Külön csomagrész (lazy), hogy a dnd-kit ne kerüljön a felhasználók által letöltött fő csomagba.

import * as React from 'react';
import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@fluentui/react/lib/Icon';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { addFieldToSection, findFieldSection, moveFieldToSection, moveSection, reorderField } from '../engine/LayoutMoves';
import { IResolvedField, IResolvedSection, unplacedFields } from '../engine/LayoutResolver';
import { IFieldSchema } from '../models/IFieldSchema';
import { IFormConfig } from '../models/IFormConfig';
import { FormRenderer, IFormRendererProps, IFormRendererSlots, ISlotProps } from './FormRenderer';

const FIELD_PREFIX: string = 'field:';
const SECTION_PREFIX: string = 'section:';
const DROP_PREFIX: string = 'drop:';
/** A tervező paneljéről húzott, még el nem helyezett mező. */
const NEW_PREFIX: string = 'new:';
/** Ennyi elmozdulás után indul a húzás, hogy a sima kattintás ne számítson annak. */
const DRAG_DISTANCE: number = 4;

const classes = mergeStyleSets({
  sortable: { position: 'relative' },
  dragging: { opacity: 0.4 },
  handle: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    padding: 0,
    border: '1px solid #c8c6c4',
    borderRadius: 2,
    background: '#ffffff',
    color: '#605e5c',
    cursor: 'grab',
    touchAction: 'none',
    selectors: { ':hover': { background: '#f3f2f1', color: '#201f1e' } }
  },
  dropZone: {
    padding: '12px',
    border: '1px dashed #c8c6c4',
    borderRadius: 2,
    color: '#605e5c',
    fontSize: 12,
    textAlign: 'center'
  },
  dropZoneOver: { borderColor: '#0078d4', background: '#eff6fc' },
  // Új mező behúzásakor: a mező ez elé a mező elé kerül, illetve ennek a szekciónak a végére.
  insertBefore: { boxShadow: '-4px 0 0 0 #0078d4' },
  insertInto: { outline: '2px dashed #0078d4', outlineOffset: 4 },
  palette: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  paletteHint: { fontSize: 12, color: '#605e5c', marginBottom: 6 },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    padding: '4px 10px 4px 6px',
    border: '1px solid #c8c6c4',
    borderRadius: 2,
    background: '#ffffff',
    font: 'inherit',
    fontSize: 13,
    color: 'inherit',
    cursor: 'grab',
    touchAction: 'none',
    selectors: { ':hover': { background: '#f3f2f1' } }
  },
  chipText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  overlay: {
    display: 'inline-block',
    padding: '6px 12px',
    border: '1px solid #0078d4',
    borderRadius: 2,
    background: '#ffffff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    fontWeight: 600,
    cursor: 'grabbing'
  }
});

function startsWith(id: unknown, prefix: string): boolean {
  return String(id).indexOf(prefix) === 0;
}

function strip(id: unknown, prefix: string): string {
  return String(id).slice(prefix.length);
}

interface IHandleProps {
  title: string;
  setRef: (element: HTMLElement | null) => void; // eslint-disable-line @rushstack/no-new-null
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners: React.HTMLAttributes<HTMLElement> | undefined;
}

const DragHandle: React.FC<IHandleProps> = (props) => (
  <button
    type="button"
    ref={props.setRef}
    className={classes.handle}
    title={props.title}
    {...props.attributes}
    {...props.listeners}
    aria-label={props.title}
    // A fogantyúra kattintás ne jelölje ki a mezőt.
    onClick={(event) => event.stopPropagation()}
  >
    <Icon iconName="GripperDotsVertical" />
  </button>
);

const SortableBox: React.FC<{ id: string; handleTitle: string; slot: ISlotProps; highlight?: boolean }> = ({
  id,
  handleTitle,
  slot,
  highlight
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { children, className, ...rest } = slot;
  return (
    <div
      ref={setNodeRef}
      {...rest}
      className={`${className} ${classes.sortable} ${isDragging ? classes.dragging : ''} ${highlight ? classes.insertBefore : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <DragHandle title={handleTitle} setRef={setActivatorNodeRef} attributes={attributes} listeners={listeners} />
      {children}
    </div>
  );
};

/** Egy szekció rácsa: a mezők rendezhető listája; üresen ejtési célként jelenik meg. */
const SortableGrid: React.FC<{ section: IResolvedSection; slot: ISlotProps; highlight?: boolean }> = ({
  section,
  slot,
  highlight
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `${DROP_PREFIX}${section.id}` });
  const empty: boolean = section.fields.length === 0;
  const filledClass: string = `${slot.className} ${highlight ? classes.insertInto : ''}`;
  return (
    <SortableContext items={section.fields.map((field) => `${FIELD_PREFIX}${field.name}`)} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} className={empty ? `${classes.dropZone} ${isOver ? classes.dropZoneOver : ''}` : filledClass}>
        {empty ? strings.DesignDropHere : slot.children}
      </div>
    </SortableContext>
  );
};

/** Egy még el nem helyezett mező a tervező paneljén; az előnézet egy szekciójába húzható. */
const PaletteChip: React.FC<{ field: IFieldSchema }> = ({ field }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${NEW_PREFIX}${field.InternalName}` });
  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${classes.chip} ${isDragging ? classes.dragging : ''}`}
      title={`${field.Title} (${field.InternalName})`}
      {...attributes}
      {...listeners}
    >
      <Icon iconName="GripperDotsVertical" />
      <span className={classes.chipText}>{field.Title}</span>
    </button>
  );
};

/**
 * Ütközésvizsgálat: szekció húzásakor csak szekciók, mező húzásakor csak mezők és szekciórácsok a célok.
 * Mezőnél a mutató alatti mező az elsődleges; ha nincs alatta mező, a szekció rácsa (üres vagy a mezők közötti hely).
 */
const detectCollision: CollisionDetection = (args) => {
  const draggingSection: boolean = startsWith(args.active.id, SECTION_PREFIX);
  const candidates = args.droppableContainers.filter((container) => startsWith(container.id, SECTION_PREFIX) === draggingSection);
  if (draggingSection) {
    return closestCenter({ ...args, droppableContainers: candidates });
  }
  const underPointer = pointerWithin({ ...args, droppableContainers: candidates });
  const fieldHit = underPointer.filter((collision) => startsWith(collision.id, FIELD_PREFIX));
  if (fieldHit.length > 0) {
    return [fieldHit[0]];
  }
  if (underPointer.length > 0) {
    return [underPointer[0]];
  }
  return closestCenter({ ...args, droppableContainers: candidates.filter((container) => startsWith(container.id, FIELD_PREFIX)) });
};

/** A húzd-és-ejtsd felület részei, amelyeket a hívó a saját elrendezésébe illeszt. */
export interface IDesignCanvasParts {
  /** Az előnézet áthelyezhető szekciókkal és mezőkkel. */
  preview: JSX.Element;
  /** A még el nem helyezett mezők behúzható listája; `undefined`, ha minden mező el van helyezve. */
  palette: JSX.Element | undefined;
}

export interface IDesignCanvasProps {
  rendererProps: IFormRendererProps;
  draft: IFormConfig;
  schema: IFieldSchema[];
  onChange: (draft: IFormConfig) => void;
  /** Az előnézet és a mezőlista egy közös húzási környezetben van, hogy a panelről az előnézetre lehessen húzni. */
  children: (parts: IDesignCanvasParts) => JSX.Element;
}

const DesignCanvas: React.FC<IDesignCanvasProps> = (props) => {
  const { rendererProps, draft } = props;
  const [activeLabel, setActiveLabel] = React.useState<string | undefined>();
  // Új mező behúzásakor a célpont: melyik mező elé, illetve melyik szekció végére kerülne.
  const [insertTarget, setInsertTarget] = React.useState<{ sectionId?: string; fieldName?: string }>({});
  // A húzás megszakításakor (Esc) erre az állapotra állunk vissza.
  const snapshot = React.useRef<IFormConfig | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** A cél szekciója és (ha mező fölött vagyunk) a mező neve. */
  const targetOf = (overId: unknown): { sectionId: string | undefined; fieldName?: string } => {
    if (startsWith(overId, FIELD_PREFIX)) {
      const fieldName: string = strip(overId, FIELD_PREFIX);
      return { sectionId: findFieldSection(draft, fieldName), fieldName };
    }
    return { sectionId: startsWith(overId, DROP_PREFIX) ? strip(overId, DROP_PREFIX) : undefined };
  };

  const onDragStart = (event: DragStartEvent): void => {
    snapshot.current = draft;
    const id: unknown = event.active.id;
    if (startsWith(id, NEW_PREFIX)) {
      const name: string = strip(id, NEW_PREFIX);
      setActiveLabel(props.schema.filter((field) => field.InternalName === name)[0]?.Title ?? name);
    } else if (startsWith(id, SECTION_PREFIX)) {
      const section = rendererProps.form.sections.filter((item) => item.id === strip(id, SECTION_PREFIX))[0];
      setActiveLabel(section?.title || strip(id, SECTION_PREFIX));
    } else {
      const name: string = strip(id, FIELD_PREFIX);
      let label: string = name;
      rendererProps.form.sections.forEach((section) =>
        section.fields.forEach((field) => {
          if (field.name === name) {
            label = field.label;
          }
        })
      );
      setActiveLabel(label);
    }
  };

  // Másik szekció fölé érve a mező azonnal átkerül, így a célszekció mezői a húzás közben helyet adnak neki.
  const onDragOver = (event: DragOverEvent): void => {
    // Új mezőnél csak a célpontot jelöljük; a mező az elengedéskor kerül a szekcióba.
    if (startsWith(event.active.id, NEW_PREFIX)) {
      setInsertTarget(event.over ? targetOf(event.over.id) : {});
      return;
    }
    if (!event.over || !startsWith(event.active.id, FIELD_PREFIX)) {
      return;
    }
    const fieldName: string = strip(event.active.id, FIELD_PREFIX);
    const target = targetOf(event.over.id);
    if (target.sectionId !== undefined && target.sectionId !== findFieldSection(draft, fieldName)) {
      props.onChange(moveFieldToSection(draft, fieldName, target.sectionId, target.fieldName));
    }
  };

  const onDragEnd = (event: DragEndEvent): void => {
    setActiveLabel(undefined);
    setInsertTarget({});
    snapshot.current = undefined;
    if (!event.over) {
      return;
    }
    if (startsWith(event.active.id, NEW_PREFIX)) {
      const target = targetOf(event.over.id);
      if (target.sectionId !== undefined) {
        props.onChange(addFieldToSection(draft, strip(event.active.id, NEW_PREFIX), target.sectionId, target.fieldName));
      }
      return;
    }
    if (startsWith(event.active.id, SECTION_PREFIX)) {
      if (startsWith(event.over.id, SECTION_PREFIX)) {
        props.onChange(moveSection(draft, strip(event.active.id, SECTION_PREFIX), strip(event.over.id, SECTION_PREFIX)));
      }
      return;
    }
    const target = targetOf(event.over.id);
    if (target.fieldName !== undefined) {
      props.onChange(reorderField(draft, strip(event.active.id, FIELD_PREFIX), target.fieldName));
    }
  };

  const onDragCancel = (): void => {
    setActiveLabel(undefined);
    setInsertTarget({});
    if (snapshot.current) {
      props.onChange(snapshot.current);
    }
    snapshot.current = undefined;
  };

  const slots: IFormRendererSlots = React.useMemo(
    () => ({
      renderSection: (section: IResolvedSection, slot: ISlotProps) => (
        <SortableBox id={`${SECTION_PREFIX}${section.id}`} handleTitle={strings.DesignDragSection} slot={slot} />
      ),
      renderGrid: (section: IResolvedSection, slot: ISlotProps) => (
        <SortableGrid
          section={section}
          slot={slot}
          highlight={insertTarget.fieldName === undefined && insertTarget.sectionId === section.id}
        />
      ),
      renderCell: (_section: IResolvedSection, field: IResolvedField, slot: ISlotProps) => (
        <SortableBox
          id={`${FIELD_PREFIX}${field.name}`}
          handleTitle={strings.DesignDragField}
          slot={slot}
          highlight={insertTarget.fieldName === field.name}
        />
      )
    }),
    [insertTarget]
  );

  const unplaced: IFieldSchema[] = unplacedFields(props.schema, draft);
  const preview: JSX.Element = (
    <SortableContext
      items={rendererProps.form.sections.map((section) => `${SECTION_PREFIX}${section.id}`)}
      strategy={verticalListSortingStrategy}
    >
      <FormRenderer {...rendererProps} slots={slots} />
    </SortableContext>
  );
  const palette: JSX.Element | undefined =
    unplaced.length === 0 ? undefined : (
      <div>
        <div className={classes.paletteHint}>{strings.DesignPaletteHint}</div>
        <div className={classes.palette}>
          {unplaced.map((field) => (
            <PaletteChip key={field.InternalName} field={field} />
          ))}
        </div>
      </div>
    );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {props.children({ preview, palette })}
      <DragOverlay>{activeLabel !== undefined ? <div className={classes.overlay}>{activeLabel}</div> : undefined}</DragOverlay>
    </DndContext>
  );
};

export default DesignCanvas;
