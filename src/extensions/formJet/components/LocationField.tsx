// Location (hely) mező: kereső a Microsoft 365 helykeresőjével; a beírt szöveg egyéni helyként is használható.
// Az érték form-string (engine/LocationValue.ts).

import * as React from 'react';
import { IconButton } from '@fluentui/react/lib/Button';
import { Callout, DirectionalHint } from '@fluentui/react/lib/Callout';
import { Link } from '@fluentui/react/lib/Link';
import { Label } from '@fluentui/react/lib/Label';
import { IBasePickerSuggestionsProps, ITag, TagPicker } from '@fluentui/react/lib/Pickers';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IResolvedField } from '../engine/LayoutResolver';
import {
  createCustomLocation,
  formatLocationAddress,
  getLocationEmbedUrl,
  getLocationMapUrl,
  getLocationName,
  ILocationData,
  parseLocationValue,
  serializeLocationValue
} from '../engine/LocationValue';
import * as LocationService from '../services/LocationService';
import { FormContext } from './FormContext';

const SEARCH_DELAY_MS: number = 400;
const MAP_WIDTH: number = 600;
const MAP_HEIGHT: number = 500;
const SELECTED_KEY: string = 'selected';
const CUSTOM_KEY: string = 'custom';

const classes = mergeStyleSets({
  labelRow: { display: 'flex', alignItems: 'center', gap: 4 },
  mapButton: { height: 24, width: 24 },
  // Keskeny ablakban a térkép a rendelkezésre álló szélességre szűkül.
  map: { display: 'block', width: MAP_WIDTH, maxWidth: '100%', height: MAP_HEIGHT, border: 'none' },
  mapFooter: { padding: '8px 12px', fontSize: 12 },
  readOnlyValue: { padding: '6px 0', minHeight: 20, wordBreak: 'break-word' },
  hint: { fontSize: 12, color: '#605e5c', marginTop: 4 },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

const SUGGESTIONS: IBasePickerSuggestionsProps = {
  noResultsFoundText: strings.LocationNoResults,
  loadingText: strings.Loading
};

export interface ILocationFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const LocationField: React.FC<ILocationFieldProps> = (props) => {
  const { field, value, error } = props;
  const { cultureName } = React.useContext(FormContext);
  const [searchFailed, setSearchFailed] = React.useState<boolean>(false);
  // A felkínált találatok kulcs szerint; a kiválasztáskor ebből vesszük a teljes helyobjektumot.
  const offered = React.useRef<Record<string, ILocationData>>({});
  const mapAnchor = React.useRef<HTMLSpanElement>(null);
  const [mapOpen, setMapOpen] = React.useState<boolean>(false);

  const location: ILocationData | undefined = React.useMemo(() => parseLocationValue(value), [value]);
  const selected: ITag[] = location ? [{ key: SELECTED_KEY, name: getLocationName(location) }] : [];
  const address: string = location ? formatLocationAddress(location) : '';

  const search = async (filter: string): Promise<ITag[]> => {
    const text: string = filter.trim();
    if (text === '') {
      return [];
    }
    const options: Record<string, ILocationData> = {};
    const tags: ITag[] = [];
    try {
      const found: ILocationData[] = await LocationService.searchLocations(text, cultureName);
      found.forEach((item, index) => {
        const key: string = `result:${index}`;
        const itemAddress: string = formatLocationAddress(item);
        options[key] = item;
        tags.push({ key, name: itemAddress ? `${getLocationName(item)} – ${itemAddress}` : getLocationName(item) });
      });
      setSearchFailed(false);
    } catch {
      setSearchFailed(true);
    }
    // A beírt szöveg egyéni helyként mindig választható, akkor is, ha a kereső nem érhető el.
    options[CUSTOM_KEY] = createCustomLocation(text);
    tags.push({ key: CUSTOM_KEY, name: format(strings.LocationUseText, text) });
    offered.current = options;
    return tags;
  };

  const onChange = (items?: ITag[]): void => {
    const picked: ITag | undefined = (items ?? []).filter((item) => item.key !== SELECTED_KEY)[0];
    if (picked) {
      props.onChange(serializeLocationValue(offered.current[String(picked.key)]));
    } else if (!items || items.length === 0) {
      props.onChange('');
    }
  };

  const message: string | undefined = error ?? (searchFailed ? strings.LocationSearchFailed : undefined);

  // A címke mellett térkép ikon: a kiválasztott helyet egy felugró térképen mutatja.
  // Koordináták nélkül (egyéni hely) nincs mit beágyazni, ilyenkor az ikon a térképes keresést nyitja meg új lapon.
  const embedUrl: string | undefined = location ? getLocationEmbedUrl(location, MAP_WIDTH, MAP_HEIGHT) : undefined;
  const labelRow: JSX.Element = (
    <div className={classes.labelRow}>
      <Label required={field.required && !field.readOnly}>{field.label}</Label>
      {location && (
        <span ref={mapAnchor}>
          {embedUrl ? (
            <IconButton
              className={classes.mapButton}
              iconProps={{ iconName: 'MapPin' }}
              title={strings.LocationShowMap}
              ariaLabel={strings.LocationShowMap}
              onClick={() => setMapOpen(!mapOpen)}
            />
          ) : (
            <IconButton
              className={classes.mapButton}
              iconProps={{ iconName: 'MapPin' }}
              title={strings.LocationShowMap}
              ariaLabel={strings.LocationShowMap}
              href={getLocationMapUrl(location)}
              target="_blank"
              rel="noopener noreferrer"
            />
          )}
        </span>
      )}
      {location && embedUrl && mapOpen && (
        <Callout
          target={mapAnchor}
          directionalHint={DirectionalHint.bottomLeftEdge}
          setInitialFocus
          onDismiss={() => setMapOpen(false)}
        >
          <iframe
            className={classes.map}
            src={embedUrl}
            title={`${field.label} – ${getLocationName(location)}`}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
          <div className={classes.mapFooter}>
            <Link href={getLocationMapUrl(location)} target="_blank" rel="noopener noreferrer">
              {strings.LocationOpenLargeMap}
            </Link>
          </div>
        </Callout>
      )}
    </div>
  );

  if (field.readOnly) {
    return (
      <div>
        {labelRow}
        <div className={classes.readOnlyValue}>{location ? getLocationName(location) : '–'}</div>
        {address !== '' && location && address !== getLocationName(location) && (
          <div className={classes.hint}>{address}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      {labelRow}
      <TagPicker
        selectedItems={selected}
        itemLimit={1}
        resolveDelay={SEARCH_DELAY_MS}
        onResolveSuggestions={search}
        onChange={onChange}
        getTextFromItem={(item) => item.name}
        pickerSuggestionsProps={SUGGESTIONS}
        styles={{ text: { background: '#ffffff' } }}
        inputProps={{
          'aria-label': field.label,
          placeholder: selected.length === 0 ? field.placeholder ?? strings.LocationPlaceholder : undefined
        }}
      />
      {address !== '' && <div className={classes.hint}>{address}</div>}
      {message && (
        <div className={classes.error} role="alert">
          {message}
        </div>
      )}
    </div>
  );
};
