import { contextBridge, ipcRenderer } from 'electron'
import type { IElectronAPI } from '../shared/types'

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

// Tek bir IPC dinleyicisi; ekranlardaki tüm abonelere dağıtır
const dataListeners = new Set<() => void>()
ipcRenderer.on('data:changed', () => dataListeners.forEach((fn) => fn()))

const api: IElectronAPI = {
  auth: {
    profiles: call('auth:profiles'),
    current: call('auth:current'),
    hasLegacyData: call('auth:hasLegacyData'),
    create: call('auth:create'),
    login: call('auth:login'),
    loginEmail: call('auth:loginEmail'),
    google: call('auth:google'),
    googleSetup: call('auth:googleSetup'),
    hint: call('auth:hint'),
    logout: call('auth:logout'),
    changePassword: call('auth:changePassword'),
    rename: call('auth:rename'),
    setEmail: call('auth:setEmail'),
    delete: call('auth:delete')
  },
  onAuthChanged: (callback) => {
    const listener = (_e: unknown, profile: Parameters<typeof callback>[0]): void => callback(profile)
    ipcRenderer.on('auth:changed', listener)
    return () => ipcRenderer.removeListener('auth:changed', listener)
  },

  areas: {
    list: call('areas:list'),
    create: call('areas:create'),
    update: call('areas:update'),
    delete: call('areas:delete'),
    reorder: call('areas:reorder')
  },
  events: {
    list: call('events:list'),
    create: call('events:create'),
    update: call('events:update'),
    delete: call('events:delete')
  },
  notify: {
    test: call('notify:test'),
    show: call('notify:show')
  },
  rituals: {
    get: call('rituals:get'),
    previousNote: call('rituals:previousNote'),
    completeMorning: call('rituals:completeMorning'),
    completeShutdown: call('rituals:completeShutdown'),
    reopen: call('rituals:reopen')
  },
  onNavigate: (callback) => {
    const listener = (_e: unknown, route: string, taskId: number | null): void => callback(route, taskId)
    ipcRenderer.on('navigate', listener)
    return () => ipcRenderer.removeListener('navigate', listener)
  },
  tasks: {
    list: call('tasks:list'),
    get: call('tasks:get'),
    create: call('tasks:create'),
    update: call('tasks:update'),
    delete: call('tasks:delete'),
    complete: call('tasks:complete'),
    uncomplete: call('tasks:uncomplete'),
    move: call('tasks:move'),
    setTop3: call('tasks:setTop3'),
    search: call('tasks:search'),
    setWaiting: call('tasks:setWaiting'),
    setPostponeReason: call('tasks:setPostponeReason'),
    createSubtasks: call('tasks:createSubtasks'),
    openFirstStep: call('tasks:openFirstStep')
  },
  tags: {
    list: call('tags:list'),
    create: call('tags:create')
  },
  recurrences: {
    list: call('recurrences:list'),
    create: call('recurrences:create'),
    update: call('recurrences:update'),
    stop: call('recurrences:stop'),
    resume: call('recurrences:resume'),
    delete: call('recurrences:delete')
  },
  settings: {
    get: call('settings:get'),
    update: call('settings:update')
  },
  capacity: {
    list: call('capacity:list'),
    set: call('capacity:set'),
    setOverride: call('capacity:setOverride'),
    override: call('capacity:override')
  },
  sessions: {
    active: call('sessions:active'),
    start: call('sessions:start'),
    stop: call('sessions:stop')
  },
  stats: {
    setEnergy: call('stats:setEnergy'),
    estimation: call('stats:estimation'),
    day: call('stats:day'),
    week: call('stats:week')
  },
  ui: {
    setTitleBar: call('ui:setTitleBar')
  },
  data: {
    exportJson: call('data:exportJson'),
    importJson: call('data:importJson')
  },
  backups: {
    list: call('backups:list'),
    now: call('backups:now'),
    openFolder: call('backups:openFolder'),
    restore: call('backups:restore')
  },
  drive: {
    status: call('drive:status'),
    connect: call('drive:connect'),
    disconnect: call('drive:disconnect'),
    backupNow: call('drive:backupNow')
  },
  files: {
    pick: call('files:pick')
  },
  mail: {
    list: call('mail:list'),
    add: call('mail:add'),
    update: call('mail:update'),
    remove: call('mail:remove'),
    sync: call('mail:sync')
  },
  ai: {
    semanticSearch: call('ai:semanticSearch')
  },
  shortcuts: {
    status: call('shortcuts:status'),
    suspend: call('shortcuts:suspend')
  },
  quick: {
    close: call('quick:close'),
    onShown: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on('quick:shown', listener)
      return () => ipcRenderer.removeListener('quick:shown', listener)
    }
  },
  onDataChanged: (callback) => {
    dataListeners.add(callback)
    return () => {
      dataListeners.delete(callback)
    }
  },
  onNotifySound: (callback) => {
    const listener = (_e: any, sound: string) => callback(sound as any)
    ipcRenderer.on('notify:sound', listener)
    return () => ipcRenderer.removeListener('notify:sound', listener)
  }
} as IElectronAPI

contextBridge.exposeInMainWorld('api', api)
