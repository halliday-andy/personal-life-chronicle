export type Events = {
  'memory/ingested': {
    data: {
      memory_id: string
      user_id: string
    }
  }
  'synthesis/invalidated': {
    data: {
      synthesis_id: string
      synthesis_type: string
      user_id: string
    }
  }
  'phase0/stage.completed': {
    data: {
      stage: 1 | 2 | 3
      user_id: string
    }
  }
  'entity/merged': {
    data: {
      survivor_id: string
      merged_id: string
      user_id: string
    }
  }
  'review-queue/item.added': {
    data: {
      item_id: string
      item_type: string
      user_id: string
      priority: number
    }
  }
  'user/period.confirmed': {
    data: {
      period_id: string
      user_id: string
    }
  }
}
