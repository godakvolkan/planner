import { app, ipcMain } from 'electron'
import { createArea, deleteArea, listAreas, reorderAreas, updateArea } from './repos/areas'
import { createEvents, deleteEvent, listEvents, updateEvent } from './repos/events'
import { notify, testNotification } from './notifier'
import { createTag, listTags } from './repos/tags'
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  moveTask,
  searchTasks,
  setPostponeReason,
  createSubtasks,
  setTop3,
  setWaiting,
  uncompleteTask,
  updateTask
} from './repos/tasks'
import { createRecurrence, deleteRecurrence, listRecurrences, resumeRecurrence, stopRecurrence, updateRecurrence } from './repos/recurrences'
import { getCapacityOverride, getSettings, listCapacity, setCapacity, setCapacityOverride, updateSettings } from './repos/settings'
import { activeSession, startSession, stopSession } from './repos/sessions'
import { daySummary, estimationProfile, setEnergy, weekStats } from './repos/stats'
import { backupNow, exportJson, importJson, listBackups, openBackupFolder, restoreBackup } from './repos/data'

import { openFirstStep, pickPath } from './firstStep'
import { completeMorning, completeShutdown, getRitual, previousNote, reopenDay } from './repos/rituals'
import { setTitleBar } from './window'
import { broadcastChange, hideQuickAdd, registerShortcuts, shortcutStatus, suspendShortcuts } from './desktop'
import type { Settings } from '../shared/types'
import { changePassword, confirmDelete, createProfile, passwordHint, setEmail, currentProfileInfo, deleteProfile, hasLegacyData, isLoggedIn, listProfiles, renameProfile } from './auth'
import { broadcastAuth, signIn, signInWithEmail, signInWithGoogle, signOut } from './session'
import { googleSetup } from './google'
import { semanticSearch } from './ai/semantic'
import { addMailAccount, listMailAccounts, removeMailAccount, syncMail, updateMailAccount } from './mail'

/** Ayar değişince işletim sistemi tarafını da uygula */
function applySettings(patch: Partial<Settings>): Settings {
  const next = updateSettings(patch)
  if (patch.keybindings !== undefined) registerShortcuts()
  if (patch.launchAtLogin !== undefined && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'] })
  }
  return next
}

/** Giriş yapmadan çağrılabilen kanallar; diğer her şey profil verisine dokunduğu için kilitli */
const PUBLIC: Record<string, (...args: never[]) => unknown> = {
  'auth:profiles': listProfiles,
  'auth:current': currentProfileInfo,
  'auth:hasLegacyData': hasLegacyData,
  'auth:create': createProfile,
  'auth:login': signIn,
  'auth:loginEmail': signInWithEmail,
  'auth:google': signInWithGoogle,
  'auth:googleSetup': googleSetup,
  'auth:hint': passwordHint,
  'auth:logout': signOut,
  'auth:delete': (id: string, password: string) => {
    confirmDelete(id, password) // şifre yanlışsa oturum kapanmadan hata
    if (currentProfileInfo()?.id === id) signOut()
    deleteProfile(id, password)
    broadcastAuth() // giriş ekranı profil listesini yeniler
  },
  'ui:setTitleBar': setTitleBar,
  'quick:close': hideQuickAdd
}

// Kanal adları preload/index.ts ile birebir aynı olmalı
const handlers: Record<string, (...args: never[]) => unknown> = {
  'auth:changePassword': changePassword,
  'auth:rename': renameProfile,
  'auth:setEmail': setEmail,
  'areas:list': listAreas,
  'areas:create': createArea,
  'areas:update': updateArea,
  'areas:delete': deleteArea,
  'areas:reorder': reorderAreas,
  'events:list': listEvents,
  'events:create': createEvents,
  'events:update': updateEvent,
  'events:delete': deleteEvent,
  'notify:test': testNotification,
  'notify:show': (title: string, body: string, route?: string) => notify(String(title).slice(0, 120), String(body).slice(0, 300), route ?? '/focus'),
  'rituals:get': getRitual,
  'rituals:previousNote': previousNote,
  'rituals:completeMorning': completeMorning,
  'rituals:completeShutdown': (date: string, note: string | null) => {
    // Gün kapanınca çalışan odak oturumu da biter
    stopSession()
    return completeShutdown(date, note)
  },
  'rituals:reopen': reopenDay,
  'tasks:list': listTasks,
  'tasks:get': getTask,
  'tasks:create': createTask,
  'tasks:update': updateTask,
  'tasks:delete': deleteTask,
  'tasks:complete': completeTask,
  'tasks:uncomplete': uncompleteTask,
  'tasks:move': moveTask,
  'tasks:setTop3': setTop3,
  'tasks:search': searchTasks,
  'tasks:setWaiting': setWaiting,
  'tasks:setPostponeReason': setPostponeReason,
  'tasks:createSubtasks': createSubtasks,
  'stats:setEnergy': setEnergy,
  'stats:estimation': estimationProfile,
  'tasks:openFirstStep': openFirstStep,
  'tags:list': listTags,
  'tags:create': createTag,
  'recurrences:list': listRecurrences,
  'recurrences:create': createRecurrence,
  'recurrences:update': updateRecurrence,
  'recurrences:stop': stopRecurrence,
  'recurrences:resume': resumeRecurrence,
  'recurrences:delete': deleteRecurrence,
  'settings:get': getSettings,
  'settings:update': applySettings,
  'capacity:list': listCapacity,
  'capacity:set': setCapacity,
  'emails:sync': syncMail,
  'capacity:setOverride': setCapacityOverride,
  'capacity:override': getCapacityOverride,
  'sessions:active': activeSession,
  'sessions:start': startSession,
  'sessions:stop': stopSession,
  'stats:day': daySummary,
  'stats:week': weekStats,
  'data:exportJson': exportJson,
  'data:importJson': importJson,
  'backups:list': listBackups,
  'backups:now': backupNow,
  'backups:openFolder': openBackupFolder,
  'backups:restore': restoreBackup,
  'files:pick': pickPath,
  'ai:semanticSearch': semanticSearch,
  'mail:list': listMailAccounts,
  'mail:add': addMailAccount,
  'mail:update': updateMailAccount,
  'mail:remove': removeMailAccount,
  'mail:sync': (id?: number) => syncMail(typeof id === 'number' ? id : undefined),
  'shortcuts:status': shortcutStatus,
  'shortcuts:suspend': suspendShortcuts
}

/** Veriyi değiştirmeyen kanallar; diğerleri başarıyla bitince tüm pencerelere "değişti" yayını yapılır */
const READ_ONLY = new Set([
  'areas:list', 'events:list', 'notify:test', 'notify:show', 'rituals:get', 'rituals:previousNote', 'tasks:list', 'tasks:get', 'tasks:search', 'tasks:openFirstStep',
  'tags:list', 'recurrences:list', 'settings:get', 'capacity:list', 'capacity:override', 'sessions:active', 'stats:day', 'stats:week', 'stats:estimation',
  'data:exportJson', 'backups:list', 'backups:openFolder', 'files:pick', 'shortcuts:status', 'shortcuts:suspend', 'auth:rename', 'ai:semanticSearch', 'mail:list'
])

export function registerIpc(): void {
  for (const [channel, fn] of Object.entries(PUBLIC)) {
    ipcMain.handle(channel, (_event, ...args) => (fn as (...a: unknown[]) => unknown)(...args))
  }
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      if (!isLoggedIn()) throw new Error('Giriş yapılmadı')
      const result = await (fn as (...a: unknown[]) => unknown)(...args)
      if (!READ_ONLY.has(channel)) broadcastChange()
      return result
    })
  }
}
