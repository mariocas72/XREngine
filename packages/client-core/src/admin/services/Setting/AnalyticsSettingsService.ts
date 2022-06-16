import { Paginated } from '@feathersjs/feathers'

import { SettingAnalytics } from '@xrengine/common/src/interfaces/SettingAnalytics'
import { matches, Validator } from '@xrengine/engine/src/common/functions/MatchesUtils'
import { defineAction, defineState, dispatchAction, getState, useState } from '@xrengine/hyperflux'

import { NotificationService } from '../../../common/services/NotificationService'
import { client } from '../../../feathers'

const AdminAnalyticsSettingsState = defineState({
  name: 'AdminAnalyticsSettingsState',
  initial: () => ({
    analytics: [] as Array<SettingAnalytics>,
    updateNeeded: true
  })
})

export const AdminAnalyticsSettingsServiceReceptor = (action) => {
  getState(AdminAnalyticsSettingsState).batch((s) => {
    matches(action).when(AdminAnalyticsSettingActions.fetchedAnalytics.matches, (action) => {
      return s.merge({ analytics: action.analyticsSettings.data, updateNeeded: false })
    })
  })
}

export const accessSettingAnalyticsState = () => getState(AdminAnalyticsSettingsState)
export const useSettingAnalyticsState = () => useState(accessSettingAnalyticsState())

export const AdminSettingAnalyticsService = {
  fetchSettingsAnalytics: async (inDec?: 'increment' | 'decrement') => {
    try {
      const analyticsSettings = (await client.service('analytics-setting').find()) as Paginated<SettingAnalytics>
      dispatchAction(AdminAnalyticsSettingActions.fetchedAnalytics({ analyticsSettings }))
    } catch (err) {
      console.log(err.message)
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  }
}

export class AdminAnalyticsSettingActions {
  static fetchedAnalytics = defineAction({
    type: 'SETTING_ANALYIS_DISPLAY' as const,
    analyticsSettings: matches.object as Validator<unknown, Paginated<SettingAnalytics>>
  })
}
