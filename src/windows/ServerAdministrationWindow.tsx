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

import * as ros from '../services/ros';

import { IWindow } from './Window';

export interface IServerAdministrationWindowProps {
  credentials: ros.IServerCredentials;
  isCloudTenant?: boolean;
  validateCertificates: boolean;
}

// TODO: Consider if we can have the window not show before a connection has been established.

export const ServerAdministrationWindow: IWindow = {
  getWindowOptions: (
    props: IServerAdministrationWindowProps,
  ): Partial<Electron.BrowserWindowConstructorOptions> => {
    const credentials = props.credentials;
    const url = credentials ? credentials.url : 'http://...';
    return {
      title: `Realm Object Server: ${url}`,
      width: 1024,
      height: 600,
    };
  },
  getComponent: () => require('../ui').ServerAdministration,
  getTrackedProperties: (props: IServerAdministrationWindowProps) => ({
    url: props.credentials.url,
  }),
};
