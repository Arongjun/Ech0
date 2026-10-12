<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <PanelCard>
    <div class="flex flex-row items-center justify-between mb-3">
      <h1 class="text-[var(--color-text-primary)] font-bold text-lg">
        {{ t('userManager.title') }}
      </h1>
      <div class="flex flex-row items-center justify-end gap-2 w-14"></div>
    </div>

    <div v-if="loading" class="flex justify-center py-4 text-[var(--color-text-muted)]">
      {{ t('userManager.loading') }}
    </div>

    <div v-else>
      <div v-if="allusers.length === 0" class="flex flex-col items-center justify-center mt-2">
        <span class="text-[var(--color-text-muted)]">{{ t('userManager.empty') }}</span>
      </div>

      <div
        v-else
        class="mt-2 x-scrollbar overflow-x-auto border border-[var(--color-border-subtle)] rounded-lg"
      >
        <table class="w-full min-w-[640px] table-fixed text-sm">
          <thead>
            <tr class="bg-[var(--color-bg-muted)]/70 text-left text-[var(--color-text-muted)]">
              <th class="w-[40px] px-2 py-2 whitespace-nowrap">#</th>
              <th class="w-[120px] px-2 py-2 whitespace-nowrap">
                {{ t('userManager.username') }}
              </th>
              <th class="px-2 py-2 whitespace-nowrap">
                {{ t('userManager.email') }}
              </th>
              <th class="w-[94px] px-2 py-2 text-center whitespace-nowrap">
                {{ t('userManager.isAdmin') }}
              </th>
              <th class="w-[100px] px-2 py-2 text-right whitespace-nowrap">
                {{ t('commonUi.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(user, index) in allusers"
              :key="user.id"
              class="border-t border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
            >
              <td class="px-2 py-2 text-[var(--color-text-primary)]">{{ index + 1 }}</td>
              <td class="px-2 py-2 text-[var(--color-text-primary)] font-semibold truncate">
                {{ user.username }}
              </td>
              <td class="px-2 py-2 text-[var(--color-text-muted)] truncate">
                {{ user.email || '—' }}
              </td>
              <td class="px-2 py-2 text-center">
                <BaseSwitch v-model="user.is_admin" @click="handleUpdateUserPermission(user.id)" />
              </td>
              <td class="px-2 py-2 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <BaseButton
                    class="h-8 w-8 !p-1.5"
                    :icon="KeyIcon"
                    @click="openResetPasswordModal(user)"
                    :tooltip="t('userManager.modifyPassword')"
                  />
                  <BaseButton
                    class="h-8 w-8 !p-1.5"
                    :icon="Deluser"
                    @click="handleDeleteUser(user.id)"
                    :tooltip="t('userManager.deleteUser')"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <BaseModal v-model="showResetPasswordModal">
      <div class="flex flex-col gap-4 max-w-sm mx-auto">
        <h2 class="text-base font-semibold text-[var(--dialog-title-color)]">
          {{ t('userManager.modifyPasswordTitle') }} ({{ selectedUser?.username }})
        </h2>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-[var(--color-text-muted)]">{{
            t('userManager.newPassword')
          }}</label>
          <BaseInput
            v-model="newPassword"
            type="password"
            :placeholder="t('userManager.passwordPlaceholder')"
            class="w-full py-1.5!"
            autocomplete="new-password"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-[var(--color-text-muted)]">{{
            t('userManager.confirmNewPassword')
          }}</label>
          <BaseInput
            v-model="confirmPassword"
            type="password"
            :placeholder="t('userManager.confirmPasswordPlaceholder')"
            class="w-full py-1.5!"
            autocomplete="new-password"
          />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <BaseButton @click="showResetPasswordModal = false">
            {{ t('commonUi.cancel') }}
          </BaseButton>
          <BaseButton
            class="!bg-[var(--ag-blue,#0a84ff)] !text-white"
            :disabled="resetSubmitting"
            @click="handleResetPasswordSubmit"
          >
            {{ t('commonUi.confirm') }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </PanelCard>
</template>

<script setup lang="ts">
import PanelCard from '@/layout/PanelCard.vue'
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSwitch from '@/components/common/BaseSwitch.vue'
import Deluser from '@/components/icons/deluser.vue'
import KeyIcon from '@/components/icons/key.vue'
import { theToast } from '@/utils/toast'
import { useBaseDialog } from '@/composables/useBaseDialog'
import {
  fetchGetAllUsers,
  fetchUpdateUserPermission,
  fetchDeleteUser,
  fetchAdminResetPassword,
} from '@/service/api'

const { openConfirm } = useBaseDialog()
const { t } = useI18n()

const loading = ref<boolean>(true)
const allusers = ref<App.Api.User.User[]>([])

const showResetPasswordModal = ref(false)
const selectedUser = ref<App.Api.User.User | null>(null)
const newPassword = ref('')
const confirmPassword = ref('')
const resetSubmitting = ref(false)

const openResetPasswordModal = (user: App.Api.User.User) => {
  selectedUser.value = user
  newPassword.value = ''
  confirmPassword.value = ''
  showResetPasswordModal.value = true
}

const handleResetPasswordSubmit = async () => {
  if (!selectedUser.value) return
  if (newPassword.value.length < 6) {
    theToast.error(String(t('userManager.passwordTooShort')))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    theToast.error(String(t('userManager.passwordMismatch')))
    return
  }
  resetSubmitting.value = true
  try {
    const res = await fetchAdminResetPassword(selectedUser.value.id, newPassword.value)
    if (res.code === 1) {
      theToast.success(res.msg || String(t('userManager.modifyPasswordSuccess')))
      showResetPasswordModal.value = false
    } else {
      theToast.error(res.msg)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err || 'Failed to modify password')
    theToast.error(message)
  } finally {
    resetSubmitting.value = false
  }
}

const handleDeleteUser = async (userId: string) => {
  openConfirm({
    title: String(t('userManager.deleteConfirmTitle')),
    description: String(t('userManager.deleteConfirmDesc')),
    onConfirm: () => {
      fetchDeleteUser(userId).then((res) => {
        if (res.code === 1) {
          getAllUsers()
        }
      })
    },
  })
}

const handleUpdateUserPermission = async (userId: string) => {
  fetchUpdateUserPermission(userId)
    .then((res) => {
      if (res.code === 1) {
        theToast.success(res.msg)
      }
    })
    .finally(() => {
      getAllUsers()
    })
}

const getAllUsers = async () => {
  loading.value = true
  try {
    const res = await fetchGetAllUsers()
    if (res.code === 1) {
      allusers.value = res.data
    }
    loading.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  getAllUsers()
})
</script>

<style scoped></style>
