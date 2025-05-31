"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RefreshCcwIcon,
  EyeIcon,
  EyeOffIcon,
  TrendingUpIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  UsersIcon,
} from "lucide-react"
import { motion } from "framer-motion"

interface PeopleCounterDisplayProps {
  count: {
    leftToRight: number
    rightToLeft: number
    total: number
  }
  onReset: () => void
  onToggleDebug: () => void
  debugMode: boolean
}

export default function PeopleCounterDisplay({ count, onReset, onToggleDebug, debugMode }: PeopleCounterDisplayProps) {
  return (
    <Card className="border-0 shadow-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-indigo-500" />
            人数カウント
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleDebug}
              className="h-8 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
            >
              {debugMode ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">{debugMode ? "詳細非表示" : "詳細表示"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
            >
              <RefreshCcwIcon className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">リセット</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <motion.div
            className="flex flex-col p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <span className="text-sm text-blue-600/80 dark:text-blue-400/80 flex items-center justify-center mb-1">
              <ArrowRightIcon className="w-4 h-4 mr-1" />
              左→右
            </span>
            <motion.span
              key={count.leftToRight}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-green-600 dark:text-green-400"
            >
              {count.leftToRight}
            </motion.span>
          </motion.div>

          <motion.div
            className="flex flex-col p-3 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-xl shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <span className="text-sm text-amber-600/80 dark:text-amber-400/80 flex items-center justify-center mb-1">
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              右→左
            </span>
            <motion.span
              key={count.rightToLeft}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-amber-600 dark:text-amber-400"
            >
              {count.rightToLeft}
            </motion.span>
          </motion.div>

          <motion.div
            className="flex flex-col p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl shadow-sm"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <span className="text-sm text-green-600/80 dark:text-green-400/80 flex items-center justify-center mb-1">
              <TrendingUpIcon className="w-4 h-4 mr-1" />
              合計
            </span>
            <motion.span
              key={count.total}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-green-600 dark:text-green-400"
            >
              {count.total}
            </motion.span>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
