import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { skillsApi, type Skill, type SkillContent } from '@/lib/api'

export function useSkills(agentId?: string) {
  return useQuery<Skill[]>({
    queryKey: ['skills', agentId ?? 'global'],
    queryFn: () => skillsApi.list(agentId),
  })
}

export function useSkillInstall(agentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (skillName: string) => skillsApi.install(agentId, skillName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', agentId] })
    },
  })
}

export function useSkillRemove(agentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (skillName: string) => skillsApi.remove(agentId, skillName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', agentId] })
    },
  })
}

export function useSkillDeleteShared() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (skillName: string) => skillsApi.deleteShared(skillName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

export function useSkillPublish() {
  return useMutation({
    mutationFn: ({ name, source, agentId }: { name: string; source?: string; agentId?: string }) =>
      skillsApi.publish(name, source, agentId),
    onSuccess: (_data, variables) => {
      alert(`Skill "${variables.name}" published to Skills Hub successfully.`)
    },
    onError: (error: Error, variables) => {
      alert(`Failed to publish "${variables.name}": ${error.message}`)
    },
  })
}

export function useSkillCreate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      skillsApi.create(name, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

export function useSkillImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, files }: { name: string; files: { path: string; content: string }[] }) =>
      skillsApi.import(name, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

/**
 * Fetch skill content for editing — resolves to the right API
 * based on source (shared vs workspace).
 */
export function useSkillContent(
  skillName: string | null,
  source?: 'shared' | 'workspace',
  agentId?: string
) {
  return useQuery<SkillContent>({
    queryKey: ['skill-content', skillName, source, agentId],
    queryFn: () => {
      if (source === 'workspace' && agentId) {
        return skillsApi.getWorkspaceContent(agentId, skillName!)
      }
      return skillsApi.getContent(skillName!)
    },
    enabled: !!skillName,
  })
}

export function useSkillUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      skillName,
      content,
      source,
      agentId,
    }: {
      skillName: string
      content: string
      source?: string
      agentId?: string
    }) => {
      if (source === 'workspace' && agentId) {
        return skillsApi.updateWorkspace(agentId, skillName, content)
      }
      return skillsApi.update(skillName, content)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}
