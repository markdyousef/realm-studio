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

import { remote as electron } from 'electron';
import * as path from 'path';

import * as realms from './realms';
import * as users from './users';

export { realms, users };
export * from './credentials';

// These interfaces are copied from ROS

export interface IUser {
  userId: string;
  isAdmin: boolean;
  accounts: IAccount[];
  metadata: IUserMetadataRow[];
}

export interface IAccount {
  provider: string;
  providerId: string;
  user?: IUser[];
}

export interface IUserMetadataRow {
  user?: IUser[];
  key: string;
  value?: string;
}

export type RealmType = 'reference' | 'partial' | 'full';

export interface IRealmFile {
  path: string;
  syncLabel: string;
  owner: IUser;
  createdAt: Date;
  permissions: IPermission[];
  realmType?: RealmType;
}

export interface IPermission {
  user: IUser;
  mayRead: boolean;
  mayWrite: boolean;
  mayManage: boolean;
}

export enum AccessLevel {
  none,
  read,
  write,
  admin,
}

// An enum to describe a users role

export enum UserRole {
  Administrator = 'administrator',
  Regular = 'regular',
}

export type Availability =
  | { available: true; version?: string }
  | { available: false };

export const isAvailable = async (url: string): Promise<Availability> => {
  const parsedUrl = new URL(url);
  parsedUrl.pathname = 'health';
  const response = await fetch(parsedUrl.toString());
  if (response.status === 200) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('application/json') !== -1) {
      const body = await response.json();
      return { available: true, version: body.version };
    } else {
      return { available: true };
    }
  } else {
    return { available: false };
  }
};
