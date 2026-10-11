// A tervező húzd-és-ejtsd műveletei a konfiguráción: szekciók és mezők áthelyezése.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.
// Minden függvény új konfigurációt ad vissza; ha nincs mit változtatni, ugyanazt az objektumot.

import { IFieldPlacement, IFormConfig, ISectionConfig } from '../models/IFormConfig';

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next: T[] = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function indexOfField(section: ISectionConfig, fieldName: string): number {
  return section.fields.reduce((found, placement, index) => (found === -1 && placement.field === fieldName ? index : found), -1);
}

/** Annak a szekciónak az azonosítója, amelyben a mező el van helyezve. */
export function findFieldSection(config: IFormConfig, fieldName: string): string | undefined {
  return config.sections.filter((section) => indexOfField(section, fieldName) !== -1)[0]?.id;
}

/**
 * Még el nem helyezett mező felvétele egy szekcióba, a megadott mező elé; `beforeFieldName` nélkül a végére.
 * Ha a mező már szerepel valamelyik szekcióban, nem változik semmi.
 */
export function addFieldToSection(
  config: IFormConfig,
  fieldName: string,
  targetSectionId: string,
  beforeFieldName?: string
): IFormConfig {
  const target: ISectionConfig | undefined = config.sections.filter((section) => section.id === targetSectionId)[0];
  if (!target || findFieldSection(config, fieldName) !== undefined) {
    return config;
  }
  const before: number = beforeFieldName === undefined ? -1 : indexOfField(target, beforeFieldName);
  const fields: IFieldPlacement[] = target.fields.slice();
  fields.splice(before === -1 ? fields.length : before, 0, { field: fieldName });
  return {
    ...config,
    sections: config.sections.map((section) => (section.id === targetSectionId ? { ...section, fields } : section))
  };
}

/** A szekció a másik szekció helyére kerül, a köztes szekciók eggyel elcsúsznak. */
export function moveSection(config: IFormConfig, sectionId: string, overSectionId: string): IFormConfig {
  const ids: string[] = config.sections.map((section) => section.id);
  const from: number = ids.indexOf(sectionId);
  const to: number = ids.indexOf(overSectionId);
  if (from === -1 || to === -1 || from === to) {
    return config;
  }
  return { ...config, sections: moveItem(config.sections, from, to) };
}

/** Szekción belüli átrendezés: a mező a másik mező helyére kerül. */
export function reorderField(config: IFormConfig, fieldName: string, overFieldName: string): IFormConfig {
  const sectionId: string | undefined = findFieldSection(config, fieldName);
  if (sectionId === undefined || sectionId !== findFieldSection(config, overFieldName) || fieldName === overFieldName) {
    return config;
  }
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === sectionId
        ? { ...section, fields: moveItem(section.fields, indexOfField(section, fieldName), indexOfField(section, overFieldName)) }
        : section
    )
  };
}

/**
 * A mező áthelyezése másik szekcióba, a megadott mező elé; `beforeFieldName` nélkül a szekció végére.
 * A mező szélessége a célszekció oszlopszámához igazodik.
 */
export function moveFieldToSection(
  config: IFormConfig,
  fieldName: string,
  targetSectionId: string,
  beforeFieldName?: string
): IFormConfig {
  const sourceSectionId: string | undefined = findFieldSection(config, fieldName);
  const target: ISectionConfig | undefined = config.sections.filter((section) => section.id === targetSectionId)[0];
  if (sourceSectionId === undefined || !target || sourceSectionId === targetSectionId) {
    return config;
  }
  const source: ISectionConfig = config.sections.filter((section) => section.id === sourceSectionId)[0];
  const moved: IFieldPlacement = { ...source.fields[indexOfField(source, fieldName)] };
  if (moved.colSpan !== undefined && moved.colSpan > target.columns) {
    moved.colSpan = target.columns;
  }
  const before: number = beforeFieldName === undefined ? -1 : indexOfField(target, beforeFieldName);
  const targetFields: IFieldPlacement[] = target.fields.slice();
  targetFields.splice(before === -1 ? targetFields.length : before, 0, moved);

  return {
    ...config,
    sections: config.sections.map((section) => {
      if (section.id === sourceSectionId) {
        return { ...section, fields: section.fields.filter((placement) => placement.field !== fieldName) };
      }
      return section.id === targetSectionId ? { ...section, fields: targetFields } : section;
    })
  };
}
