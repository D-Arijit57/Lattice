/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { AuthPage } from "@/pages/AuthPage"
import { WorkspaceOverview } from "@/pages/WorkspaceOverview"
import { ContentTypesList } from "@/pages/content-types/ContentTypesList"
import { ContentTypeWorkspace } from "@/pages/content-types/ContentTypeWorkspace"
import { ContentTypeOverview } from "@/pages/content-types/ContentTypeOverview"
import { SchemaEditor } from "@/pages/content-types/SchemaEditor"
import { SchemaVersions } from "@/pages/content-types/SchemaVersions"
import { EntriesList } from "@/pages/content-types/EntriesList"
import { EntryEditor } from "@/pages/content-types/EntryEditor"
import { ApiDocs } from "@/pages/content-types/ApiDocs"

export default function App() {
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<WorkspaceOverview />} />
            <Route path="/content-types" element={<ContentTypesList />} />
            <Route path="/content-types/:slug" element={<ContentTypeWorkspace />}>
              <Route index element={<ContentTypeOverview />} />
              <Route path="schema" element={<SchemaEditor />} />
              <Route path="versions" element={<SchemaVersions />} />
              <Route path="entries" element={<EntriesList />} />
              <Route path="api" element={<ApiDocs />} />
            </Route>
            <Route path="/content-types/:slug/entries/:entryId" element={<EntryEditor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
    </BrowserRouter>
  )
}
