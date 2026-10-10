declare interface IFormJetFormCustomizerStrings {
  // Form
  Loading: string;
  LoadFailed: string;
  Save: string;
  Saving: string;
  Cancel: string;
  Close: string;
  RequiredField: string;
  SaveFailed: string;
  UnknownError: string;
  Yes: string;
  No: string;
  DateHint: string;
  GoToToday: string;
  InvalidDate: string;
  Time: string;
  InvalidTime: string;
  HiddenTag: string;
  RteBold: string;
  RteItalic: string;
  RteUnderline: string;
  RteStrike: string;
  RteHeading: string;
  RteBulletList: string;
  RteNumberedList: string;
  RteLink: string;
  RteRemoveLink: string;
  RteClearFormatting: string;
  RteUndo: string;
  RteRedo: string;
  RteLinkUrl: string;
  NoContentType: string;

  // Item conflict
  ConflictTitle: string;
  ConflictText: string;
  Overwrite: string;
  Reload: string;

  // Configuration
  ConfigListUnavailable: string;
  ConfigInvalid: string;
  MissingFields: string;
  ConfigConflict: string;
  ConfigDenied: string;
  ConfigSaveFailed: string;

  // Designer
  Designer: string;
  DesignerSave: string;
  DesignerNotice: string;
  PreviewMode: string;
  ModeNew: string;
  ModeEdit: string;
  ModeDisplay: string;
  TabLayout: string;
  TabField: string;
  TabJson: string;
  FormTitle: string;
  NewSection: string;
  SectionMoveUp: string;
  SectionMoveDown: string;
  SectionDelete: string;
  SectionTitle: string;
  SectionEmpty: string;
  Description: string;
  ColumnCount: string;
  Collapsible: string;
  CollapsedByDefault: string;
  VisibleInModes: string;
  ReadOnlyInModes: string;
  RequiredInModes: string;
  VisibleWhen: string;
  ReadOnlyWhen: string;
  RequiredWhen: string;
  ConditionHelp: string;
  InvalidJsonShort: string;
  Fields: string;
  Field: string;
  FieldSettings: string;
  FieldWidth: string;
  FieldMoveUp: string;
  FieldMoveDown: string;
  FieldRemove: string;
  AddField: string;
  NonexistentField: string;
  UnplacedFields: string;
  AllFieldsPlaced: string;
  UnplacedFieldsList: string;
  FieldPickerPlaceholder: string;
  FieldType: string;
  SpRequired: string;
  SpReadOnly: string;
  FieldLabel: string;
  PlaceholderText: string;
  DefaultValue: string;
  DefaultValueHint: string;
  RequiredOnlyStricter: string;
  ConfigJson: string;
  Apply: string;

  // Designer: style tab
  TabStyle: string;
  StyleScope: string;
  StyleScopeBase: string;
  StyleScopeHint: string;
  StyleForm: string;
  StyleSection: string;
  StyleAccentColor: string;
  StyleBackground: string;
  StyleBorderColor: string;
  StyleHeaderColor: string;
  StyleLabelColor: string;
  StyleMaxWidth: string;
  StyleMaxWidthError: string;
  StyleDensity: string;
  StyleDensityComfortable: string;
  StyleDensityCompact: string;
  StyleSectionHeader: string;
  StyleHeaderUnderline: string;
  StyleHeaderBar: string;
  StyleHeaderPlain: string;
  StyleInherited: string;
  StyleInvalidColor: string;
  StylePickColor: string;
  StyleClear: string;

  // Related items
  RelatedEnable: string;
  RelatedList: string;
  RelatedMatchField: string;
  RelatedSourceField: string;
  RelatedSourceId: string;
  RelatedMatchHint: string;
  RelatedColumns: string;
  RelatedSortField: string;
  RelatedSortDescending: string;
  RelatedRowLimit: string;
  RelatedShowNewButton: string;
  RelatedNewItem: string;
  RelatedRefresh: string;
  RelatedEmpty: string;
  RelatedMore: string;
  RelatedLoadFailed: string;
  RelatedListsFailed: string;
  RelatedMatchFieldError: string;
  RelatedIncomplete: string;
  RelatedNeedsItem: string;

  // Engine messages; must match IEngineStrings (engine/EngineStrings.ts)
  Engine: {
    ConditionRoot: string;
    MustBeObject: string;
    MustBeArray: string;
    MissingField: string;
    UnknownOperator: string;
    InNeedsArray: string;
    ValueMustBeScalar: string;
    InvalidJson: string;
    RootMustBeObject: string;
    UnknownSchemaVersion: string;
    InvalidModes: string;
    DuplicateSectionId: string;
    InvalidColor: string;
    InvalidNumber: string;
    InvalidOption: string;
    InvalidListId: string;
    InvalidFieldName: string;
  };
}

declare module 'FormJetFormCustomizerStrings' {
  const strings: IFormJetFormCustomizerStrings;
  export = strings;
}
