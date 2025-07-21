"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SmartphoneIcon, MonitorIcon, XIcon, PlusIcon, CameraIcon, RefreshCwIcon } from "lucide-react"
import CameraViewerSingle from "@/components/camera-viewer-single"
import { motion } from "framer-motion"

// カメラ接続情報の型定義
interface CameraInfo {
  id: string
  roomId: string
}

// ランダムなルームIDを生成する関数
const generateRandomRoomId = (): string => {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

export default function Home() {
  const [roomId, setRoomId] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("viewer")
  const [showIframe, setShowIframe] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [isLoadingScripts, setIsLoadingScripts] = useState(false)
  const [quality, setQuality] = useState("ultralow")

  // 複数カメラ接続を管理するための状態（シンプルな配列）
  const [cameras, setCameras] = useState<CameraInfo[]>([])
  const [newCameraRoomId, setNewCameraRoomId] = useState("")
  const [showAddCamera, setShowAddCamera] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // ページロード時にランダムなルームIDを生成
  useEffect(() => {
    const randomRoomId = generateRandomRoomId()
    setRoomId(randomRoomId)
    setNewCameraRoomId(randomRoomId)
  }, [])

  // 接続URLの生成
  const cameraUrl = typeof window !== "undefined" ? `${window.location.origin}?room=${roomId}&mode=camera` : ""

  // クリップボードにコピー
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // 新しいランダムルームIDを生成
  const generateNewRoomId = () => {
    const newRandomRoomId = generateRandomRoomId()
    setRoomId(newRandomRoomId)
    setNewCameraRoomId(newRandomRoomId)
  }

  // URLパラメータからモードとルームIDを取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const mode = params.get("mode")
      const room = params.get("room")

      if (mode === "camera") {
        setActiveTab("camera")
      }

      if (room) {
        setRoomId(room)
        setNewCameraRoomId(room)
      }
    }
  }, [])

  // TensorFlow.jsとCOCO-SSDモデルのスクリプトを読み込む
  const loadScripts = () => {
    // すでに読み込まれている場合は何もしない
    if (scriptsLoaded || isLoadingScripts) {
      console.log("スクリプトは既に読み込まれているか読み込み中です")
      return
    }

    console.log("スクリプトの読み込みを開始します...")
    setIsLoadingScripts(true)

    // グローバルオブジェクトにスクリプト読み込み状態を追跡するプロパティを追加
    if (typeof window !== "undefined") {
      // TensorFlow.jsの読み込み
      const tfScript = document.createElement("script")
      tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js"
      tfScript.async = true
      tfScript.onload = () => {
        console.log("TensorFlow.js読み込み完了")

        // TensorFlow.jsの読み込み完了後にCOCO-SSDを読み込む
        const cocoSsdScript = document.createElement("script")
        cocoSsdScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js"
        cocoSsdScript.async = true
        cocoSsdScript.onload = () => {
          console.log("COCO-SSDモデル読み込み完了")
          setScriptsLoaded(true)
          setIsLoadingScripts(false)
        }
        cocoSsdScript.onerror = (e) => {
          console.error("COCO-SSDモデル読み込みエラー:", e)
          setIsLoadingScripts(false)
        }
        document.head.appendChild(cocoSsdScript)
      }
      tfScript.onerror = (e) => {
        console.error("TensorFlow.js読み込みエラー:", e)
        setIsLoadingScripts(false)
      }
      document.head.appendChild(tfScript)
    }
  }

  // 新しいカメラ接続を追加
  const addCameraConnection = () => {
    if (!newCameraRoomId) return

    // 既に同じルームIDの接続がある場合は追加しない
    if (cameras.some((cam) => cam.roomId === newCameraRoomId)) {
      alert(`ルームID "${newCameraRoomId}" の接続は既に存在します。`)
      return
    }

    const newConnectionId = `camera-${Date.now()}`

    // シンプルな配列に追加
    setCameras((prev) => [
      ...prev,
      {
        id: newConnectionId,
        roomId: newCameraRoomId,
      },
    ])

    setNewCameraRoomId("")
    setShowAddCamera(false)
  }

  // カメラ接続を削除
  const removeCameraConnection = (connectionId: string) => {
    setCameras((prev) => prev.filter((cam) => cam.id !== connectionId))
  }

  // カメラのルームIDを更新
  const updateCameraRoomId = (connectionId: string, newRoomId: string) => {
    setCameras((prev) => prev.map((cam) => (cam.id === connectionId ? { ...cam, roomId: newRoomId } : cam)))
  }

  // デバッグモードの切り替え
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
  }

  // カメラモードの場合のレンダリング
  if (activeTab === "camera") {
    return (
      <div className="min-h-screen py-4 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="w-full max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl"
          >
            <Card className="border-0 shadow-lg overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
              <CardHeader className="pb-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
                <CardTitle className="text-2xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                  リモートカメラビューアー
                </CardTitle>
                <CardDescription className="text-center">
                  スマートフォンカメラの映像をブラウザに表示します
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 rounded-lg p-1 bg-gray-100 dark:bg-gray-800">
                    <TabsTrigger
                      value="viewer"
                      className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all"
                    >
                      <MonitorIcon className="w-4 h-4 mr-2" />
                      視聴モード（PC）
                    </TabsTrigger>
                    <TabsTrigger
                      value="camera"
                      className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all"
                    >
                      <SmartphoneIcon className="w-4 h-4 mr-2" />
                      カメラモード（スマホ）
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="camera" className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label htmlFor="camera-room-id" className="text-sm font-medium">
                          ルームID
                        </Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="camera-room-id"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="ルームIDを入力"
                            className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={generateNewRoomId}
                            className="bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                            title="新しいランダムIDを生成"
                          >
                            <RefreshCwIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      {!showIframe ? (
                        <div className="relative h-[500px] md:h-[600px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl overflow-hidden flex flex-col items-center justify-center text-gray-400 gap-4">
                          <CameraIcon className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                          「カメラを開始」ボタンをクリックしてカメラを起動します
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="relative h-[500px] md:h-[600px] rounded-xl overflow-hidden shadow-inner"
                        >
                          <div className="absolute top-2 right-2 z-10">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 shadow-md"
                              onClick={() => setShowIframe(false)}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          <iframe
                            ref={iframeRef}
                            src={`/api/connect?room=${roomId}&mode=camera&embedded=true`}
                            className="w-full h-full rounded-xl border-0"
                            allow="camera;microphone"
                            title="カメラプレビュー"
                          />
                        </motion.div>
                      )}
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
                      onClick={() => setShowIframe(true)}
                      disabled={showIframe}
                    >
                      カメラを開始
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  // 視聴モードの場合のレンダリング
  return (
    <div className="min-h-screen py-6 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
      <div className="w-full max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-6xl"
        >
          <Card className="border-0 shadow-lg overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
            <CardHeader className="pb-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
              <CardTitle className="text-2xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                リモートカメラビューアー
              </CardTitle>
              <CardDescription className="text-center">
                複数のスマートフォンカメラの映像をブラウザに表示します
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 rounded-lg p-1 bg-gray-100 dark:bg-gray-800">
                  <TabsTrigger
                    value="viewer"
                    className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all"
                  >
                    <MonitorIcon className="w-4 h-4 mr-2" />
                    視聴モード（PC）
                  </TabsTrigger>
                  <TabsTrigger
                    value="camera"
                    className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all"
                  >
                    <SmartphoneIcon className="w-4 h-4 mr-2" />
                    カメラモード（スマホ）
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="viewer" className="space-y-4">
                  {/* カメラ接続がない場合の表示 */}
                  {cameras.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl"
                    >
                      <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 dark:from-indigo-500/30 dark:to-purple-500/30 flex items-center justify-center">
                        <CameraIcon className="w-10 h-10 text-indigo-500/70 dark:text-indigo-400/70" />
                      </div>
                      <p className="mb-6 text-gray-500 dark:text-gray-400 text-center">カメラが接続されていません</p>
                      <Button
                        onClick={() => setShowAddCamera(true)}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        カメラを追加
                      </Button>
                    </motion.div>
                  )}

                  {/* カメラ追加フォーム */}
                  {showAddCamera && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="mb-6 border border-indigo-100 dark:border-indigo-900/50 shadow-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                        <CardHeader className="pb-2 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10">
                          <CardTitle className="text-lg font-medium">新しいカメラを追加</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <Label htmlFor="new-room-id" className="text-sm font-medium">
                                ルームID
                              </Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  id="new-room-id"
                                  value={newCameraRoomId}
                                  onChange={(e) => setNewCameraRoomId(e.target.value)}
                                  placeholder="ルームIDを入力"
                                  className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setNewCameraRoomId(generateRandomRoomId())}
                                  className="bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                                  title="新しいランダムIDを生成"
                                >
                                  <RefreshCwIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-end gap-2">
                              <Button
                                onClick={addCameraConnection}
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm"
                              >
                                追加
                              </Button>
                              <Button variant="outline" onClick={() => setShowAddCamera(false)}>
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* カメラ接続リスト - 各カメラを独立したコンポーネントとして表示 */}
                  {cameras.map((camera, index) => (
                    <motion.div
                      key={camera.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <CameraViewerSingle
                        id={camera.id}
                        roomId={camera.roomId}
                        index={index}
                        debugMode={debugMode}
                        scriptsLoaded={scriptsLoaded}
                        isLoadingScripts={isLoadingScripts}
                        onLoadScripts={loadScripts}
                        onRemove={() => removeCameraConnection(camera.id)}
                        onUpdateRoomId={(newRoomId) => updateCameraRoomId(camera.id, newRoomId)}
                        onToggleDebugMode={toggleDebugMode}
                        onCopyUrl={(url) => copyToClipboard(url)}
                      />
                    </motion.div>
                  ))}

                  {/* カメラ追加ボタン */}
                  {cameras.length > 0 && (
                    <div className="flex justify-center mt-8">
                      <Button
                        onClick={() => setShowAddCamera(true)}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        カメラを追加
                      </Button>
                    </div>
                  )}

                  {/* スクリプト読み込み状態 */}
                  {isLoadingScripts && (
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        人物検出モデルを読み込み中... しばらくお待ちください。
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
