////////////////////////////////////////////////////////////////////////////
//
// Copyright 2018 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////

import * as electron from 'electron';
import * as React from 'react';
import * as Realm from 'realm';

import * as ros from '../../../services/ros';
import { store } from '../../../store';

import { showError } from '../../reusable/errors';
import { querySomeFieldContainsText } from '../utils';
import { RealmsTable } from './RealmsTable';

export type ValidateCertificatesChangeHandler = (
  validateCertificates: boolean,
) => void;

export interface IRealmTableContainerProps {
  adminRealm: Realm;
  adminRealmChanges: number;
  createRealm: () => Promise<ros.IRealmFile>;
  onRealmOpened: (path: string) => void;
  onValidateCertificatesChange: ValidateCertificatesChangeHandler;
  user: Realm.Sync.User;
  validateCertificates: boolean;
}

export interface IRealmTableContainerState {
  selectedRealmPath: string | null;
  searchString: string;
  showPartialRealms: boolean;
  showSystemRealms: boolean;
}

class RealmsTableContainer extends React.PureComponent<
  IRealmTableContainerProps,
  IRealmTableContainerState
> {
  public state: IRealmTableContainerState = {
    selectedRealmPath: null,
    searchString: '',
    showPartialRealms: store.shouldShowPartialRealms(),
    showSystemRealms: store.shouldShowSystemRealms(),
  };

  protected realms?: Realm.Results<ros.IRealmFile>;

  public componentWillMount() {
    this.setRealms(
      this.state.searchString,
      this.state.showPartialRealms,
      this.state.showSystemRealms,
    );
  }

  public componentWillUpdate(
    nextProps: IRealmTableContainerProps,
    nextState: IRealmTableContainerState,
  ) {
    if (
      this.state.searchString !== nextState.searchString ||
      this.state.showPartialRealms !== nextState.showPartialRealms ||
      this.state.showSystemRealms !== nextState.showSystemRealms
    ) {
      this.setRealms(
        nextState.searchString,
        nextState.showPartialRealms,
        nextState.showSystemRealms,
      );
    }
  }

  public render() {
    return this.realms ? (
      <RealmsTable
        realms={this.realms}
        onRealmCreation={this.onRealmCreation}
        {...this.state}
        {...this}
      />
    ) : null;
  }

  public componentDidMount() {
    store.onDidChange(store.KEY_SHOW_PARTIAL_REALMS, (newVal, oldVal) => {
      if (oldVal !== newVal) {
        const val = newVal === true;
        this.setState({ showPartialRealms: val });
      }
    });

    store.onDidChange(store.KEY_SHOW_SYSTEM_REALMS, (newVal, oldVal) => {
      if (oldVal !== newVal) {
        const val = newVal === true;
        this.setState({ showSystemRealms: val });
      }
    });
  }

  public getRealmFromId = (path: string): ros.IRealmFile | undefined => {
    const { adminRealm } = this.props;
    return adminRealm.objectForPrimaryKey<ros.IRealmFile>('RealmFile', path);
  };

  public getRealmPermissions = (
    path: string,
  ): Realm.Results<ros.IPermission> => {
    const { adminRealm } = this.props;
    const realmFile = this.getRealmFromId(path);
    return adminRealm
      .objects<ros.IPermission>('Permission')
      .filtered('realmFile == $0', realmFile);
  };

  public onRealmCreation = async () => {
    try {
      const realm = await this.props.createRealm();
      this.onRealmSelected(realm.path);
    } catch (err) {
      if (err.message === 'Realm creation cancelled') {
        // This is an expected expression to be thrown - no need to show it
        return;
      }
      showError('Failed to create Realm', err);
    }
  };

  public onRealmDeletion = async (path: string) => {
    const confirmed = this.confirmRealmDeletion(path);
    if (confirmed) {
      try {
        await ros.realms.remove(this.props.user, path);
        if (path === this.state.selectedRealmPath) {
          this.onRealmSelected(null);
        }
      } catch (err) {
        showError('Error deleting realm', err);
      }
    }
  };

  public onRealmOpened = (path: string) => {
    this.props.onRealmOpened(path);
    // Make sure the Realm that just got opened, is selected
    this.onRealmSelected(path);
  };

  public onRealmTypeUpgrade = async (path: string) => {
    const confirmed = this.confirmRealmTypeUpgrade(path);
    if (confirmed) {
      try {
        await ros.realms.changeType(this.props.user, path, 'reference');
      } catch (err) {
        showError('Failed to upgrade the Realm', err);
      }
    }
  };

  public onRealmSelected = (path: string | null) => {
    this.setState({
      selectedRealmPath: path,
    });
  };

  public onSearchStringChange = (searchString: string) => {
    this.setState({ searchString });
  };

  protected setRealms(
    searchString: string,
    showPartialRealms: boolean,
    showSystemRealms: boolean,
  ) {
    this.realms = this.props.adminRealm.objects<ros.IRealmFile>('RealmFile');

    // Filter if a search string is specified
    if (searchString || searchString !== '') {
      const filterQuery = querySomeFieldContainsText(
        ['path', 'realmType', 'owner.accounts.providerId'],
        searchString,
      );
      try {
        this.realms = this.realms.filtered(filterQuery);
      } catch (err) {
        // tslint:disable-next-line:no-console
        console.warn(`Could not filter on "${filterQuery}"`, err);
      }
    }

    // Filter out System and Partial Realms based on global preferences
    if (showPartialRealms === false) {
      this.realms = this.realms.filtered("NOT path CONTAINS '/__partial/'");
    }
    if (showSystemRealms === false) {
      // Hide all system realms, including the old Permission system Realms,
      // but make sure to not hide partial Realms.
      this.realms = this.realms.filtered(
        "NOT path BEGINSWITH '/__' " +
          "AND NOT path ENDSWITH '__management' " +
          "AND NOT path ENDSWITH '__perm' " +
          "AND NOT path ENDSWITH '__permission' ",
      );
    }
  }

  private confirmRealmDeletion(path: string): boolean {
    const result = electron.remote.dialog.showMessageBox(
      electron.remote.getCurrentWindow(),
      {
        type: 'warning',
        message:
          'Before deleting the Realm here, make sure that any / all clients (iOS, Android, Js, etc.) has already deleted the app or database locally. If this is not done, they will try to upload their copy of the database - which might have been replaced in the meantime.',
        title: `Deleting ${path}`,
        buttons: ['Cancel', 'Delete'],
      },
    );

    return result === 1;
  }

  private confirmRealmTypeUpgrade(path: string): boolean {
    const result = electron.remote.dialog.showMessageBox(
      electron.remote.getCurrentWindow(),
      {
        type: 'warning',
        message:
          'Upgrading the Realm to be a Reference Realm will delete all current permissions for it. WARNING: This operation cannot be reverted.',
        title: `Upgrading type of ${path}`,
        buttons: ['Cancel', 'Upgrade to "reference" Realm'],
      },
    );

    return result === 1;
  }
}

export { RealmsTableContainer as RealmsTable };
