// A lista helyi menüjének FormJet menüpontja: megerősítés, futás közben várakozás, utána visszajelzés.
// A FormJetCommandSet egy külön, a lap végére tett elembe rajzolja; a bezárása után a hívó frissíti a listát.

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IListCommand } from '../models/IListCommands';
import { ICommandRunResult } from '../services/ListCommandService';

type Phase = 'confirm' | 'running' | 'done' | 'failed';

export interface ICommandDialogProps {
  command: IListCommand;
  /** A lépések végrehajtása; a hibát a dialógus jeleníti meg. */
  onRun: () => Promise<ICommandRunResult>;
  /** Bezárás; `changed`: lefutott-e valami (ilyenkor a hívó frissíti a listát). */
  onClose: (changed: boolean) => void;
}

export const CommandDialog: React.FC<ICommandDialogProps> = ({ command, onRun, onClose }) => {
  const [phase, setPhase] = React.useState<Phase>('confirm');
  const [result, setResult] = React.useState<ICommandRunResult | undefined>();
  const [error, setError] = React.useState<string | undefined>();

  const run = (): void => {
    setPhase('running');
    onRun()
      .then((next) => {
        setResult(next);
        setPhase('done');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error && e.message ? e.message : String(e));
        setPhase('failed');
      });
  };

  // Futás közben nem zárható be, hogy a felhasználó ne higgye, hogy megszakította.
  const dismiss = (): void => {
    if (phase !== 'running') {
      // Hibánál is lehetett már lefutott lépés, ezért a listát akkor is frissítjük.
      onClose(phase === 'done' || phase === 'failed');
    }
  };

  return (
    <Dialog
      hidden={false}
      minWidth={420}
      onDismiss={dismiss}
      dialogContentProps={{ type: DialogType.normal, title: command.title }}
      modalProps={{ isBlocking: true }}
    >
      {phase === 'confirm' && <div>{command.confirm || format(strings.CommandConfirmDefault, command.title)}</div>}
      {phase === 'running' && <Spinner size={SpinnerSize.medium} label={strings.CommandRunning} />}
      {phase === 'done' && result && (
        <MessageBar messageBarType={MessageBarType.success}>
          {command.successMessage || strings.CommandSuccessDefault}{' '}
          {format(strings.CommandResultSummary, result.updatedFields, result.updatedItems, result.createdItems)}
        </MessageBar>
      )}
      {phase === 'failed' && <MessageBar messageBarType={MessageBarType.error}>{format(strings.CommandFailed, error ?? '')}</MessageBar>}
      <DialogFooter>
        {phase === 'confirm' && (
          <>
            <PrimaryButton text={strings.CommandRun} onClick={run} />
            <DefaultButton text={strings.Cancel} onClick={() => onClose(false)} />
          </>
        )}
        {(phase === 'done' || phase === 'failed') && <PrimaryButton text={strings.Close} onClick={dismiss} />}
      </DialogFooter>
    </Dialog>
  );
};
