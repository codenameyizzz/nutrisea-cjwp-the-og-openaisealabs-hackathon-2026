"use client";

import { createContext, useContext } from "react";
import type { AccountSnapshot } from "../services/account-session";

export const AccountSessionContext = createContext<{ account: AccountSnapshot | null }>({ account: null });
export function useAccountSession() { return useContext(AccountSessionContext); }
