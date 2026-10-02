import { uuidv4 } from '@routier/core';

export const uniqueName = (prefix: string): string => `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

export const environment = (name: string): string | null => {
    const value = process.env[name];
    return value == null || value === '' ? null : value;
};
