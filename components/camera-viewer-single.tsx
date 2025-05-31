"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyIcon, TrashIcon, Settings2Icon, ZapIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PeopleCounterDisplay from "@/components/people-counter-display"
import { PeopleCounter } from "@/utils/people-counter"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CameraViewerSingleProps {
  id: string
  roomId: string
  index: number
  debugMode: boolean
  scriptsLoaded: boolean
  isLoadingScripts: boolean
  onLoadScripts: () => void
  onRemove: () => void
  onUpdateRoomId: (roomId: string) => void
  onToggleDebugMode: () => void
  onCopyUrl: (url: string) => void
}

export default function CameraViewerSingle({
  id,
  roomId,
  index,
  debugMode,
  scriptsLoaded,
  isLoadingScripts,
  onLoadScripts,
  onRemove,
  onUpdateRoomId,
  onToggleDebugMode,
  onCopyUrl,
}: CameraViewerSingleProps) {
  // 各カメラ接続の状態
  const [connectionStatus, setConnectionStatus] = useState("未接続")
  const [quality, setQuality] = useState("low")
  const [showPeopleCounter, setShowPeopleCounter] = useState(false)
  const [peopleCount, setPeopleCount] = useState({ leftToRight: 0, rightToLeft: 0, total: 0 })
  const [imageReceived, setImageReceived] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [analysisMode, setAnalysisMode] = useState<"overlay" | "separate">("overlay") // オーバーレイまたは分離表示

  // 各カメラ接続のref
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const remoteImageRef = useRef<HTMLImageElement>(null)
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null) // オーバーレイ用キャンバス
  const peopleCounterRef = useRef<PeopleCounter | null>(null)

  // カメラURLの生成
  const cameraUrl = typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}&mode=camera` : ""

  // 人物カウント機能が有効になったらスクリプトを読み込む
  useEffect(() => {
    if (showPeopleCounter && !scriptsLoaded && !isLoadingScripts) {
      onLoadScripts()
    } else if (showPeopleCounter && scriptsLoaded && !peopleCounterRef.current) {
      initPeopleCounter()
    }
  }, [showPeopleCounter, scriptsLoaded, isLoadingScripts])

  // スクリプトが読み込まれたら人物カウンターを初期化
  useEffect(() => {
    if (scriptsLoaded && showPeopleCounter && !peopleCounterRef.current) {
      initPeopleCounter()
    }
  }, [scriptsLoaded, showPeopleCounter])

  // デバッグモードが変更されたら人物カウンターのデバッグモードも更新
  useEffect(() => {
    if (peopleCounterRef.current) {
      peopleCounterRef.current.setDebugMode(debugMode)
    }
  }, [debugMode])

  // 人物カウンターの初期化
  const initPeopleCounter = () => {
    console.log(`カメラ ${id} の人物カウンター初期化開始`)

    if (!peopleCounterRef.current && scriptsLoaded) {
      console.log(`カメラ ${id} の人物カウンターを初期化しています...`)

      if (typeof window !== "undefined" && !(window as any).cocoSsd) {
        console.error("COCO-SSDモデルがグローバルオブジェクトに見つかりません")
        return
      }

      peopleCounterRef.current = new PeopleCounter()
      peopleCounterRef.current.setCountUpdateCallback((count) => {
        console.log(`カメラ ${id} のカウント更新受信:`, count)
        setPeopleCount(count)
      })
      peopleCounterRef.current.setDebugMode(debugMode)

      // 分析モードに応じてキャンバスを設定
      const canvas = analysisMode === "overlay" ? overlayCanvasRef.current : analysisCanvasRef.current
      if (canvas) {
        console.log(`カメラ ${id} の分析キャンバスを設定します (${analysisMode}モード)`)

        // キャンバスサイズが初期化されていることを確認
        if (canvasSizeInitialized.current) {
          // キャンバスサイズを設定
          canvas.width = canvasSize.width
          canvas.height = canvasSize.height
          console.log(`キャンバスサイズを設定: ${canvasSize.width}x${canvasSize.height}`)
        } else {
          console.log(`キャンバスサイズがまだ初期化されていません。デフォルトサイズを使用します。`)
        }

        peopleCounterRef.current.setAnalysisCanvas(canvas)
      }

      // 横断ラインを設定
      updateCrossingLine()

      console.log(`カメラ ${id} の人物カウンター初期化完了`)

      // 既に画像が受信されている場合は、人物検出を実行
      if (imageReceived && remoteImageRef.current) {
        console.log(`カメラ ${id} の初期化後に既存の画像で人物検出を実行します`)
        setTimeout(() => {
          if (peopleCounterRef.current && remoteImageRef.current) {
            const canvas = analysisMode === "overlay" ? overlayCanvasRef.current : analysisCanvasRef.current
            if (canvas) {
              peopleCounterRef.current.detectPeople(remoteImageRef.current, canvas)
            }
          }
        }, 500)
      }
    }
  }

  // 横断ラインの更新
  const updateCrossingLine = () => {
    if (!peopleCounterRef.current) return

    const canvas = analysisMode === "overlay" ? overlayCanvasRef.current : analysisCanvasRef.current
    if (!canvas) return

    // キャンバスサイズが初期化されている場合はそのサイズを使用、そうでなければデフォルト値
    const width = canvasSizeInitialized.current ? canvasSize.width : canvas.width || 640
    const height = canvasSizeInitialized.current ? canvasSize.height : canvas.height || 480

    console.log(`カメラ ${id} の横断ラインを設定: キャンバスサイズ=${width}x${height}`)

    peopleCounterRef.current.setCrossingLine(width * 0.1, height * 0.5, width * 0.9, height * 0.5)
  }

  // 画像の読み込み完了ハンドラ
  const handleImageLoad = () => {
    console.log(`カメラ ${id} の画像が読み込まれました`)
    setImageReceived(true)

    if (showPeopleCounter && peopleCounterRef.current && scriptsLoaded) {
      console.log(`カメラ ${id} の画像読み込み完了 - 人物検出を実行します`)
      const canvas = analysisMode === "overlay" ? overlayCanvasRef.current : analysisCanvasRef.current
      if (canvas && remoteImageRef.current) {
        peopleCounterRef.current.detectPeople(remoteImageRef.current, canvas)
      }
    }
  }

  // キャンバスサイズの初期設定用の状態
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 })
  const canvasSizeInitialized = useRef(false)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 接続状態の更新
      if (
        event.data &&
        event.data.type === "connection-status" &&
        iframeRef.current &&
        event.source === iframeRef.current.contentWindow
      ) {
        setConnectionStatus(event.data.status)
      }

      // 画像データの受信（人物検出用）
      if (
        event.data &&
        event.data.type === "image-data" &&
        iframeRef.current &&
        event.source === iframeRef.current.contentWindow &&
        remoteImageRef.current
      ) {
        // 画像データを設定
        remoteImageRef.current.src = event.data.data
        setImageReceived(true)

        // キャンバスサイズを初期化（最初の1回のみ）
        if (!canvasSizeInitialized.current && event.data.width && event.data.height) {
          console.log(`カメラ ${id} のキャンバスサイズを初期化: ${event.data.width}x${event.data.height}`)
          setCanvasSize({ width: event.data.width, height: event.data.height })

          // オーバーレイキャンバスのサイズを設定
          if (overlayCanvasRef.current) {
            overlayCanvasRef.current.width = event.data.width
            overlayCanvasRef.current.height = event.data.height
          }

          // 分析キャンバスのサイズも設定
          if (analysisCanvasRef.current) {
            analysisCanvasRef.current.width = event.data.width
            analysisCanvasRef.current.height = event.data.height
          }

          canvasSizeInitialized.current = true
        }

        // 画像が読み込まれたら人物検出を実行
        if (showPeopleCounter && peopleCounterRef.current && scriptsLoaded) {
          console.log(`カメラ ${id} の画像データを受信しました - 人物検出を実行します`)
          setTimeout(() => {
            if (peopleCounterRef.current && remoteImageRef.current) {
              const canvas = analysisMode === "overlay" ? overlayCanvasRef.current : analysisCanvasRef.current
              if (canvas) {
                peopleCounterRef.current.detectPeople(remoteImageRef.current, canvas)
              }
            }
          }, 100)
        }
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [id, showPeopleCounter, scriptsLoaded, analysisMode])

  // 分析モードの変更
  const handleAnalysisModeChange = (mode: "overlay" | "separate") => {
    setAnalysisMode(mode)

    // iframeにオーバーレイモードの状態を通知
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "toggle-overlay-mode",
          enabled: mode === "overlay",
        },
        "*",
      )
    }

    // 人物カウンターのキャンバスを更新
    if (peopleCounterRef.current) {
      const canvas = mode === "overlay" ? overlayCanvasRef.current : analysisCanvasRef.current
      if (canvas) {
        // キャンバスサイズが初期化されていることを確認
        if (canvasSizeInitialized.current) {
          // キャンバスサイズを設定
          canvas.width = canvasSize.width
          canvas.height = canvasSize.height
        }

        peopleCounterRef.current.setAnalysisCanvas(canvas)
        updateCrossingLine()
      }
    }
  }

  // 品質設定の変更
  const handleQualityChange = (value: string) => {
    setQuality(value)
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "quality-change",
          quality: value,
        },
        "*",
      )
    }
  }

  // 人物カウントのリセット
  const resetPeopleCount = () => {
    if (peopleCounterRef.current) {
      peopleCounterRef.current.resetCount()
    }
  }

  // 人物カウント機能の切り替え
  const togglePeopleCounter = () => {
    const newState = !showPeopleCounter
    setShowPeopleCounter(newState)

    // iframeにオーバーレイモードの状態を通知
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "toggle-overlay-mode",
          enabled: newState && analysisMode === "overlay",
        },
        "*",
      )
    }

    if (newState) {
      console.log(`カメラ ${id} の人物カウント機能を有効にします`)
      if (!scriptsLoaded && !isLoadingScripts) {
        onLoadScripts()
      } else if (scriptsLoaded && !peopleCounterRef.current) {
        initPeopleCounter()
      }
    } else {
      console.log(`カメラ ${id} の人物カウント機能を無効にします`)
    }
  }

  // URLをコピーする関数
  const handleCopyUrl = (url: string) => {
    onCopyUrl(url)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // iframeの読み込み完了後に初期状態を通知
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleIframeLoad = () => {
      // 少し遅延を入れてからメッセージを送信
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "toggle-overlay-mode",
              enabled: showPeopleCounter && analysisMode === "overlay",
            },
            "*",
          )
        }
      }, 1000)
    }

    iframe.addEventListener("load", handleIframeLoad)

    return () => {
      iframe.removeEventListener("load", handleIframeLoad)
    }
  }, [showPeopleCounter, analysisMode])

  return (
    <motion.div
      className="mb-8 border-0 rounded-xl overflow-hidden shadow-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold shadow-md">
              {index + 1}
            </div>
            <div>
              <h3 className="text-lg font-medium">カメラ {index + 1}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={connectionStatus.includes("接続済み") ? "success" : "secondary"}
                  className={`transition-all duration-500 ${connectionStatus.includes("接続済み") ? "animate-pulse" : ""}`}
                >
                  {connectionStatus}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(cameraUrl)}
                    className="bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 transition-all"
                  >
                    {isCopied ? (
                      <span className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        コピー済み
                      </span>
                    ) : (
                      <>
                        <CopyIcon className="w-4 h-4 mr-1" />
                        URLをコピー
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>カメラ接続用URLをコピー</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onRemove}
                    className="bg-red-500/90 hover:bg-red-600 transition-all"
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    削除
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>このカメラを削除</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <Label htmlFor={`room-id-${id}`} className="text-sm font-medium">
              ルームID
            </Label>
            <Input
              id={`room-id-${id}`}
              value={roomId}
              onChange={(e) => onUpdateRoomId(e.target.value)}
              placeholder="ルームIDを入力"
              className="mt-1 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Settings2Icon className="w-4 h-4 text-gray-500" />
            <Select value={quality} onValueChange={handleQualityChange}>
              <SelectTrigger className="w-[140px] h-10 bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="画質設定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">高画質 (低FPS)</SelectItem>
                <SelectItem value="medium">標準 (中FPS)</SelectItem>
                <SelectItem value="low">低画質 (高FPS)</SelectItem>
                <SelectItem value="ultralow">超低画質 (最高FPS)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 分析モード選択 */}
        {showPeopleCounter && (
          <div className="flex items-center gap-4 mb-4">
            <Label className="text-sm font-medium">分析表示モード:</Label>
            <div className="flex gap-2">
              <Button
                variant={analysisMode === "overlay" ? "default" : "outline"}
                size="sm"
                onClick={() => handleAnalysisModeChange("overlay")}
                className={`text-xs ${analysisMode === "overlay" ? "bg-green-600 hover:bg-green-700" : ""}`}
              >
                オーバーレイ表示
              </Button>
              <Button
                variant={analysisMode === "separate" ? "default" : "outline"}
                size="sm"
                onClick={() => handleAnalysisModeChange("separate")}
                className={`text-xs ${analysisMode === "separate" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              >
                分離表示
              </Button>
            </div>
          </div>
        )}

        {/* メイン映像表示エリア */}
        <div
          className={`grid gap-4 mb-4 ${analysisMode === "separate" && showPeopleCounter ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
        >
          {/* メインの映像表示エリア */}
          <div>
            <div className="relative h-[300px] md:h-[400px] bg-black rounded-xl overflow-hidden shadow-inner">
              {/* 人物検出用の非表示画像要素 */}
              {showPeopleCounter && (
                <img
                  ref={remoteImageRef}
                  className="hidden"
                  alt="カメラ映像"
                  crossOrigin="anonymous"
                  width={640}
                  height={480}
                  onLoad={handleImageLoad}
                />
              )}

              {/* 映像を表示するiframe */}
              <iframe
                ref={iframeRef}
                src={`/api/connect?room=${roomId}&mode=viewer&embedded=true`}
                className="w-full h-full rounded-xl border-0"
                allow="camera;microphone"
                title={`カメラ ${index + 1}`}
              />

              {/* オーバーレイキャンバス（オーバーレイモード時のみ） */}
              {showPeopleCounter && analysisMode === "overlay" && (
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  width={canvasSize.width}
                  height={canvasSize.height}
                  style={{
                    background: "transparent",
                    objectFit: "contain",
                    objectPosition: "center",
                    zIndex: 10, // 確実に最前面に表示
                  }}
                />
              )}

              {/* 接続状態インジケーター */}
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${connectionStatus.includes("接続済み") ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
                ></div>
                {connectionStatus}
              </div>
            </div>
          </div>

          {/* 分析映像表示エリア（分離表示モード時のみ） */}
          {analysisMode === "separate" && (
            <div className="relative h-[300px] md:h-[400px] bg-black rounded-xl overflow-hidden shadow-inner">
              <div className="absolute top-3 left-3 z-10">
                <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs">
                  分析映像
                </span>
              </div>
              {!showPeopleCounter ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-3 bg-gradient-to-br from-gray-900 to-gray-800">
                  <ZapIcon className="w-10 h-10 text-gray-600" />
                  <p className="text-sm">
                    人物カウント機能を有効にすると
                    <br />
                    分析映像が表示されます
                  </p>
                </div>
              ) : (
                <canvas
                  ref={analysisCanvasRef}
                  className="w-full h-full object-contain"
                  width={640}
                  height={480}
                  style={{ background: "#000" }}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={showPeopleCounter ? "default" : "outline"}
            onClick={togglePeopleCounter}
            className={`flex-1 ${
              showPeopleCounter
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                : "border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            人物カウント {showPeopleCounter ? "オフ" : "オン"}
          </Button>

          {showPeopleCounter && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleDebugMode}
              className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
            >
              {debugMode ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* 人物カウント表示 */}
        {showPeopleCounter && (
          <motion.div
            className="mt-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
          >
            <PeopleCounterDisplay
              count={peopleCount}
              onReset={resetPeopleCount}
              onToggleDebug={onToggleDebugMode}
              debugMode={debugMode}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
