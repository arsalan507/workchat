import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../services/api'
import { TaskStatus, TaskPriority, TASK_STATUS_COLORS, isOverdue as checkOverdue } from '@workchat/shared'

type TaskFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
  </svg>
)

export default function TasksPanel() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/api/tasks')
      return response.data.data
    },
  })

  const tasks = tasksData || []

  // Filter tasks
  const filteredTasks = tasks.filter((task: any) => {
    // Search filter
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    // Status filter
    if (activeFilter === 'pending' && task.status !== TaskStatus.PENDING) {
      return false
    }
    if (activeFilter === 'in_progress' && task.status !== TaskStatus.IN_PROGRESS) {
      return false
    }
    if (activeFilter === 'completed' && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.APPROVED) {
      return false
    }
    if (activeFilter === 'overdue') {
      const isTaskOverdue = task.dueDate && checkOverdue(task.dueDate) &&
        task.status !== TaskStatus.APPROVED &&
        task.status !== TaskStatus.COMPLETED
      if (!isTaskOverdue) return false
    }

    return true
  })

  const filters: { id: TaskFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: tasks.length },
    { id: 'pending', label: 'Pending', count: tasks.filter((t: any) => t.status === TaskStatus.PENDING).length },
    { id: 'in_progress', label: 'In Progress', count: tasks.filter((t: any) => t.status === TaskStatus.IN_PROGRESS).length },
    { id: 'completed', label: 'Completed', count: tasks.filter((t: any) => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED).length },
    { id: 'overdue', label: 'Overdue', count: tasks.filter((t: any) => t.dueDate && checkOverdue(t.dueDate) && t.status !== TaskStatus.APPROVED && t.status !== TaskStatus.COMPLETED).length },
  ]

  return (
    <div className="h-full flex flex-col bg-[#111B21]">
      {/* Header */}
      <div className="h-[60px] px-4 flex items-center gap-3 bg-[#202C33] border-b border-[#222D34]">
        <h2 className="text-xl font-medium text-[#E9EDEF]">Tasks</h2>
        <div className="flex-1" />
        <button className="p-2 text-[#AEBAC1] hover:text-white transition-colors">
          <FilterIcon />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-[#111B21]">
        <div className="flex items-center gap-3 bg-[#202C33] rounded-lg px-3 py-2">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#E9EDEF] placeholder-[#8696A0] outline-none text-sm"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeFilter === filter.id
                ? 'bg-[#00A884] text-[#111B21]'
                : 'bg-[#202C33] text-[#E9EDEF] hover:bg-[#2A3942]'
            }`}
          >
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeFilter === filter.id
                  ? 'bg-[#111B21]/20 text-[#111B21]'
                  : 'bg-[#3B4A54] text-[#E9EDEF]'
              }`}>
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#00A884] border-t-transparent rounded-full" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#8696A0] px-8 text-center">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <p className="text-sm">
              {searchQuery ? 'No tasks found' : 'No tasks yet'}
            </p>
            <p className="text-xs mt-2 opacity-75">
              Tasks are created from chat messages
            </p>
          </div>
        ) : (
          filteredTasks.map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => task.chatId && navigate(`/chat/${task.chatId}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface TaskCardProps {
  task: any
  onClick: () => void
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const statusColor = TASK_STATUS_COLORS[task.status as TaskStatus] || TASK_STATUS_COLORS.PENDING
  const isTaskOverdue = task.dueDate && checkOverdue(task.dueDate) &&
    task.status !== TaskStatus.APPROVED &&
    task.status !== TaskStatus.COMPLETED

  const priorityColors: Record<string, string> = {
    LOW: '#8696A0',
    MEDIUM: '#00A884',
    HIGH: '#F59E0B',
    URGENT: '#EF4444',
  }

  const formatDueDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) return `${Math.abs(days)} days overdue`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `Due in ${days} days`
  }

  return (
    <div
      onClick={onClick}
      className="px-4 py-3 hover:bg-[#202C33] cursor-pointer border-b border-[#222D34] transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div
          className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: statusColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-[#E9EDEF] font-medium truncate">
            {task.title}
          </h3>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-1">
            {/* Owner */}
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[#6B7C85] flex items-center justify-center text-white text-[10px] font-medium">
                {task.owner?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="text-xs text-[#8696A0]">{task.owner?.name}</span>
            </div>

            {/* Priority */}
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${priorityColors[task.priority]}20`,
                color: priorityColors[task.priority],
              }}
            >
              {task.priority}
            </span>

            {/* Status */}
            <span className="text-xs text-[#8696A0]">
              {task.status.replace('_', ' ')}
            </span>
          </div>

          {/* Due date */}
          {task.dueDate && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${isTaskOverdue ? 'text-[#EF4444]' : 'text-[#8696A0]'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              <span>{formatDueDate(task.dueDate)}</span>
            </div>
          )}

          {/* Steps progress */}
          {task.steps && task.steps.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#3B4A54] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00A884] rounded-full transition-all"
                    style={{
                      width: `${(task.steps.filter((s: any) => s.completedAt).length / task.steps.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-[#8696A0]">
                  {task.steps.filter((s: any) => s.completedAt).length}/{task.steps.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg className="w-5 h-5 text-[#8696A0] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>
    </div>
  )
}
