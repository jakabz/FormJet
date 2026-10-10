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
  };
}

declare module 'FormJetFormCustomizerStrings' {
  const strings: IFormJetFormCustomizerStrings;
  export = strings;
}
