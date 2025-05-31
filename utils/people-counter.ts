// 人物検出と追跡のためのクラス
export class PeopleCounter {
  private model: any = null
  private isModelLoading = false
  private crossingLine: { x1: number; y1: number; x2: number; y2: number } = { x1: 0, y1: 0, x2: 0, y2: 0 }
  private trackedPeople: Map<
    string,
    {
      id: string
      box: any
      crossed: boolean
      direction: string | null
      lastPosition: { x: number; y: number }
      positions: Array<{ x: number; y: number; timestamp: number }>
      lastSeen: number
      confidence: number
      crossingConfidence: number
      hasEnteredLeftSide: boolean // 左側エリアに入ったか
      hasEnteredRightSide: boolean // 右側エリアに入ったか
      lastSide: string | null // 最後にいた側（"left" | "right" | null）
    }
  > = new Map()
  private peopleCount = { leftToRight: 0, rightToLeft: 0, total: 0 }
  private lastDetectionTime = 0
  private detectionInterval = 30 // 検出間隔をさらに短縮（50ms→30ms）
  private cleanupInterval = 2000 // クリーンアップ間隔を短縮（3000ms→2000ms）
  private onCountUpdate: ((count: { leftToRight: number; rightToLeft: number; total: number }) => void) | null = null
  private debugMode = false
  private canvasWidth = 0
  private canvasHeight = 0
  private analysisCanvas: HTMLCanvasElement | null = null
  private modelLoadPromise: Promise<any> | null = null
  private frameCount = 0
  private minTrackingConfidence = 0.15 // 追跡信頼度をさらに下げる（0.25→0.15）
  private minCrossingConfidence = 0.1 // 横断信頼度をさらに下げる（0.2→0.1）
  private positionHistoryLimit = 30 // 位置履歴を増やす（20→30）
  private crossingThreshold = 0.02 // 移動距離閾値をさらに下げる（0.05→0.02）
  private lastCountUpdateTime = 0

  constructor() {
    // クリーンアップタイマーの設定
    setInterval(() => this.cleanupTrackedPeople(), this.cleanupInterval)

    // 初期化時にモデルの読み込みを開始
    this.loadModel()
  }

  // モデルの読み込み
  async loadModel() {
    if (this.model) {
      console.log("モデルは既に読み込まれています")
      return this.model
    }

    if (this.modelLoadPromise) {
      console.log("モデルを読み込み中です...")
      return this.modelLoadPromise
    }

    console.log("モデルの読み込みを開始します")
    this.isModelLoading = true

    // モデル読み込みのPromiseを作成
    this.modelLoadPromise = new Promise(async (resolve, reject) => {
      try {
        // グローバルオブジェクトからCOCO-SSDモデルを取得
        if (typeof window !== "undefined" && (window as any).cocoSsd) {
          console.log("COCO-SSDモデルを読み込みます...")
          const loadedModel = await (window as any).cocoSsd.load()
          console.log("人物検出モデルを読み込みました")
          this.model = loadedModel
          this.isModelLoading = false
          resolve(loadedModel)
        } else {
          console.error("COCO-SSDモデルが見つかりません")
          console.log("window.cocoSsd:", typeof window !== "undefined" ? (window as any).cocoSsd : "undefined")
          this.isModelLoading = false
          reject(new Error("COCO-SSDモデルが見つかりません"))
        }
      } catch (error) {
        console.error("モデル読み込みエラー:", error)
        this.isModelLoading = false
        reject(error)
      }
    })

    return this.modelLoadPromise
  }

  // 横断ラインの設定
  setCrossingLine(x1: number, y1: number, x2: number, y2: number) {
    this.crossingLine = { x1, y1, x2, y2 }
    console.log(`横断ラインを設定: (${x1}, ${y1}) - (${x2}, ${y2})`)
  }

  // カウント更新時のコールバック設定
  setCountUpdateCallback(callback: (count: { leftToRight: number; rightToLeft: number; total: number }) => void) {
    this.onCountUpdate = callback
    console.log("カウント更新コールバックが設定されました")
  }

  // デバッグモードの設定
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled
  }

  // 分析キャンバスの設定
  setAnalysisCanvas(canvas: HTMLCanvasElement | null) {
    this.analysisCanvas = canvas
    console.log("分析キャンバスを設定しました:", canvas ? `${canvas.width}x${canvas.height}` : "null")
  }

  // 人物検出の実行
  async detectPeople(imageElement: HTMLImageElement | HTMLVideoElement, canvas: HTMLCanvasElement) {
    try {
      // モデルが読み込まれていない場合は読み込む
      if (!this.model) {
        console.log("モデルが読み込まれていないため、読み込みを開始します")
        try {
          this.model = await this.loadModel()
        } catch (error) {
          console.error("モデル読み込みに失敗しました:", error)
          return
        }
      }

      const now = Date.now()
      if (now - this.lastDetectionTime < this.detectionInterval) {
        // 検出間隔が短すぎる場合はスキップ
        return
      }
      this.lastDetectionTime = now
      this.frameCount++

      // 画像が読み込まれているか確認
      if (imageElement instanceof HTMLImageElement && !imageElement.complete) {
        console.log("画像がまだ読み込まれていません")
        return
      }

      // キャンバスのコンテキスト取得
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        console.error("キャンバスコンテキストを取得できません")
        return
      }

      // 画像サイズに合わせてキャンバスをリサイズ
      let imgWidth = 0
      let imgHeight = 0

      if (imageElement instanceof HTMLImageElement) {
        // 画像要素の場合
        imgWidth = imageElement.naturalWidth || imageElement.width || 640
        imgHeight = imageElement.naturalHeight || imageElement.height || 480

        // 画像が正しく読み込まれているか確認
        if (imgWidth === 0 || imgHeight === 0) {
          console.error("画像のサイズが取得できません")
          console.log("画像の状態:", imageElement.complete, imageElement.naturalWidth, imageElement.naturalHeight)
          return
        }
      } else {
        // ビデオ要素の場合
        imgWidth = imageElement.videoWidth || imageElement.clientWidth || 640
        imgHeight = imageElement.videoHeight || imageElement.clientHeight || 480
      }

      // キャンバスのサイズを設定
      canvas.width = imgWidth
      canvas.height = imgHeight
      this.canvasWidth = imgWidth
      this.canvasHeight = imgHeight

      // キャンバスのクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 分析キャンバスに元の画像を描画（半透明に）
      ctx.globalAlpha = 0.7
      ctx.drawImage(imageElement, 0, 0, imgWidth, imgHeight)
      ctx.globalAlpha = 1.0

      // 人物検出の実行
      const predictions = await this.model.detect(imageElement)

      // 人物の検出と追跡
      this.trackPeople(predictions, ctx)

      // 横断ラインを描画
      this.drawCrossingLine(ctx)

      // デバッグ用に検出状態を表示
      if (this.debugMode) {
        this.drawDebugInfo(ctx, predictions)
      }
    } catch (error) {
      console.error("検出エラー:", error)
    }
  }

  // デバッグ情報の描画
  private drawDebugInfo(ctx: CanvasRenderingContext2D, predictions: any[]) {
    const personCount = predictions.filter((p) => p.class === "person").length

    // 背景を描画
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(0, 0, 300, 140)

    // 検出情報
    ctx.fillStyle = "white"
    ctx.font = "12px Arial"
    ctx.fillText(`フレーム: ${this.frameCount}`, 10, 20)
    ctx.fillText(`検出オブジェクト: ${predictions.length}個`, 10, 40)
    ctx.fillText(`検出人物: ${personCount}人`, 10, 60)
    ctx.fillText(`追跡人物: ${this.trackedPeople.size}人`, 10, 80)
    ctx.fillText(`カウント - 左→右: ${this.peopleCount.leftToRight}, 右→左: ${this.peopleCount.rightToLeft}`, 10, 100)
    ctx.fillText(`画面サイズ: ${this.canvasWidth}x${this.canvasHeight}`, 10, 120)

    // 左右エリアの境界を表示
    const centerX = this.canvasWidth / 2
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, this.canvasHeight)
    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"
    ctx.lineWidth = 2
    ctx.setLineDash([10, 5])
    ctx.stroke()
    ctx.setLineDash([])

    // エリア表示
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    ctx.font = "16px Arial"
    ctx.fillText("左エリア", 10, this.canvasHeight - 20)
    ctx.fillText("右エリア", centerX + 10, this.canvasHeight - 20)
  }

  // 横断ラインの描画
  private drawCrossingLine(ctx: CanvasRenderingContext2D) {
    // メインライン（表示用）
    ctx.beginPath()
    ctx.moveTo(this.crossingLine.x1, this.crossingLine.y1)
    ctx.lineTo(this.crossingLine.x2, this.crossingLine.y2)
    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"
    ctx.lineWidth = 3
    ctx.stroke()

    // ラインの方向を示す矢印を描画
    const midX = (this.crossingLine.x1 + this.crossingLine.x2) / 2
    const midY = (this.crossingLine.y1 + this.crossingLine.y2) / 2

    // 左右方向の表示
    ctx.fillStyle = "white"
    ctx.font = "14px Arial"
    ctx.fillText("左", this.crossingLine.x1 - 25, midY + 5)
    ctx.fillText("右", this.crossingLine.x2 + 10, midY + 5)

    // 左右の矢印
    this.drawArrow(ctx, this.crossingLine.x1 - 5, midY, this.crossingLine.x1 - 20, midY, "white")
    this.drawArrow(ctx, this.crossingLine.x2 + 5, midY, this.crossingLine.x2 + 20, midY, "white")

    // カウント表示
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)"
    ctx.fillRect(this.crossingLine.x1 - 40, this.crossingLine.y1 - 40, 35, 25)
    ctx.fillStyle = "black"
    ctx.fillText(`${this.peopleCount.rightToLeft}`, this.crossingLine.x1 - 30, this.crossingLine.y1 - 22)

    ctx.fillStyle = "rgba(0, 255, 0, 0.8)"
    ctx.fillRect(this.crossingLine.x2 + 5, this.crossingLine.y2 - 40, 35, 25)
    ctx.fillStyle = "black"
    ctx.fillText(`${this.peopleCount.leftToRight}`, this.crossingLine.x2 + 15, this.crossingLine.y2 - 22)

    // 合計表示
    ctx.fillStyle = "rgba(255, 255, 0, 0.8)"
    ctx.fillRect(midX - 20, midY - 40, 40, 25)
    ctx.fillStyle = "black"
    ctx.fillText(`${this.peopleCount.total}`, midX - 5, midY - 22)
  }

  // 矢印を描画するヘルパーメソッド
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
  ) {
    const headLength = 10
    const angle = Math.atan2(toY - fromY, toX - fromX)

    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(toX, toY)
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6))
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // 人物の追跡処理
  private trackPeople(predictions: any[], ctx: CanvasRenderingContext2D) {
    // 人物のみをフィルタリング - 信頼度の閾値を下げる
    const people = predictions.filter((pred) => pred.class === "person" && pred.score > this.minTrackingConfidence)

    // 現在のフレームで検出された人物のID
    const currentIds = new Set<string>()
    const now = Date.now()

    for (const person of people) {
      // 検出された人物のバウンディングボックス
      const [x, y, width, height] = person.bbox
      const centerX = x + width / 2
      const centerY = y + height / 2

      // 最も近い追跡中の人物を見つける
      const closestId = this.findClosestPerson(centerX, centerY, person.bbox, person.score)

      if (closestId) {
        // 既存の人物を更新
        const trackedPerson = this.trackedPeople.get(closestId)!

        // 前回の位置を保存
        const lastPosition = trackedPerson.lastPosition

        // 位置履歴を更新
        trackedPerson.positions.push({
          x: centerX,
          y: centerY,
          timestamp: now,
        })

        // 履歴が多すぎる場合は古いものを削除
        if (trackedPerson.positions.length > this.positionHistoryLimit) {
          trackedPerson.positions.shift()
        }

        // 位置と信頼度を更新
        trackedPerson.box = person.bbox
        trackedPerson.lastPosition = { x: centerX, y: centerY }
        trackedPerson.lastSeen = now
        trackedPerson.confidence = Math.max(trackedPerson.confidence, person.score)

        currentIds.add(closestId)

        // 簡易横断チェック（新しいロジック）
        this.checkScreenCrossing(trackedPerson, centerX, centerY, lastPosition, ctx)
      } else {
        // 新しい人物を追加
        const newId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const currentSide = this.getCurrentSide(centerX)

        this.trackedPeople.set(newId, {
          id: newId,
          box: person.bbox,
          crossed: false,
          direction: null,
          lastPosition: { x: centerX, y: centerY },
          positions: [{ x: centerX, y: centerY, timestamp: now }],
          lastSeen: now,
          confidence: person.score,
          crossingConfidence: 0,
          hasEnteredLeftSide: currentSide === "left",
          hasEnteredRightSide: currentSide === "right",
          lastSide: currentSide,
        })
        currentIds.add(newId)
      }

      // バウンディングボックスを描画
      this.drawBoundingBox(
        ctx,
        person,
        centerX,
        centerY,
        this.findClosestPerson(centerX, centerY, person.bbox, person.score),
      )
    }

    // 追跡中の人物の状態を更新
    for (const [id, person] of this.trackedPeople.entries()) {
      if (!currentIds.has(id)) {
        // このフレームで検出されなかった人物
        if (now - person.lastSeen < 1500) {
          // 1.5秒以内に消失した人物のみ表示
          this.drawDisappearedPerson(ctx, person)
        }
      }

      // 位置履歴の描画
      if (this.debugMode && person.positions.length > 1) {
        this.drawPositionHistory(ctx, person)
      }
    }

    // カウント情報を毎フレーム更新（デバッグ用）
    if (this.onCountUpdate) {
      this.onCountUpdate({
        leftToRight: this.peopleCount.leftToRight,
        rightToLeft: this.peopleCount.rightToLeft,
        total: this.peopleCount.total,
      })
    }
  }

  // 現在の位置がどちら側かを判定
  private getCurrentSide(centerX: number): string | null {
    const screenCenter = this.canvasWidth / 2
    const margin = this.canvasWidth * 0.1 // 10%のマージン

    if (centerX < screenCenter - margin) {
      return "left"
    } else if (centerX > screenCenter + margin) {
      return "right"
    }
    return null // 中央エリア
  }

  // 画面横断チェック（新しい簡易ロジック）
  private checkScreenCrossing(
    person: {
      id: string
      box: any
      crossed: boolean
      direction: string | null
      lastPosition: { x: number; y: number }
      positions: Array<{ x: number; y: number; timestamp: number }>
      lastSeen: number
      confidence: number
      crossingConfidence: number
      hasEnteredLeftSide: boolean
      hasEnteredRightSide: boolean
      lastSide: string | null
    },
    centerX: number,
    centerY: number,
    lastPosition: { x: number; y: number },
    ctx: CanvasRenderingContext2D,
  ) {
    // すでに横断済みの場合は処理しない
    if (person.crossed) return

    // 現在の位置がどちら側かを判定
    const currentSide = this.getCurrentSide(centerX)

    // 側が変わった場合の処理
    if (currentSide && currentSide !== person.lastSide) {
      console.log(`人物 ${person.id.substring(0, 6)} が ${person.lastSide} から ${currentSide} に移動`)

      // 側の記録を更新
      if (currentSide === "left") {
        person.hasEnteredLeftSide = true
      } else if (currentSide === "right") {
        person.hasEnteredRightSide = true
      }

      person.lastSide = currentSide

      // 両側を経験した場合はカウント
      if (person.hasEnteredLeftSide && person.hasEnteredRightSide && !person.crossed) {
        person.crossed = true

        // 最後の移動方向でカウント方向を決定
        const direction = centerX > lastPosition.x ? "right" : "left"
        person.direction = direction

        if (direction === "right") {
          this.peopleCount.leftToRight++
          console.log(`左→右カウント: ${this.peopleCount.leftToRight}`)
        } else {
          this.peopleCount.rightToLeft++
          console.log(`右→左カウント: ${this.peopleCount.rightToLeft}`)
        }

        this.peopleCount.total = this.peopleCount.leftToRight + this.peopleCount.rightToLeft

        // 横断軌跡を描画
        this.drawCrossingTrajectory(ctx, person, direction)

        // カウント更新を強制的に通知（即座に実行）
        console.log(
          `カウント更新通知: 左→右=${this.peopleCount.leftToRight}, 右→左=${this.peopleCount.rightToLeft}, 合計=${this.peopleCount.total}`,
        )
        if (this.onCountUpdate) {
          this.onCountUpdate({
            leftToRight: this.peopleCount.leftToRight,
            rightToLeft: this.peopleCount.rightToLeft,
            total: this.peopleCount.total,
          })
        }
      }
    }

    // 移動軌跡を描画
    if (currentSide) {
      this.drawMovementPath(ctx, lastPosition, centerX, centerY)
    }
  }

  // 位置履歴の描画
  private drawPositionHistory(ctx: CanvasRenderingContext2D, person: any) {
    if (person.positions.length < 2) return

    ctx.beginPath()
    ctx.moveTo(person.positions[0].x, person.positions[0].y)

    for (let i = 1; i < person.positions.length; i++) {
      ctx.lineTo(person.positions[i].x, person.positions[i].y)
    }

    // 横断済みかどうかで色を変える
    ctx.strokeStyle = person.crossed
      ? person.direction === "right"
        ? "rgba(0, 255, 0, 0.7)"
        : "rgba(255, 165, 0, 0.7)"
      : "rgba(0, 191, 255, 0.7)"
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // バウンディングボックスの描画
  private drawBoundingBox(
    ctx: CanvasRenderingContext2D,
    person: any,
    centerX: number,
    centerY: number,
    id: string | null,
  ) {
    const [x, y, width, height] = person.bbox

    // 追跡情報を取得
    const trackedPerson = id ? this.trackedPeople.get(id) : null
    const hasCrossed = trackedPerson?.crossed || false
    const direction = trackedPerson?.direction || null
    const currentSide = this.getCurrentSide(centerX)

    // バウンディングボックスを描画（横断済みかどうかで色を変える）
    ctx.strokeStyle = hasCrossed
      ? direction === "right"
        ? "rgba(0, 255, 0, 0.8)"
        : "rgba(255, 165, 0, 0.8)"
      : currentSide === "left"
        ? "rgba(0, 255, 255, 0.8)"
        : currentSide === "right"
          ? "rgba(255, 0, 255, 0.8)"
          : "rgba(128, 128, 128, 0.8)"
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, width, height)

    // 中心点を描画
    ctx.fillStyle = hasCrossed
      ? direction === "right"
        ? "rgba(0, 255, 0, 0.8)"
        : "rgba(255, 165, 0, 0.8)"
      : currentSide === "left"
        ? "rgba(0, 255, 255, 0.8)"
        : currentSide === "right"
          ? "rgba(255, 0, 255, 0.8)"
          : "rgba(128, 128, 128, 0.8)"
    ctx.beginPath()
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2)
    ctx.fill()

    // 信頼度を表示
    ctx.fillStyle = "white"
    ctx.font = "12px Arial"
    ctx.fillText(`${Math.round(person.score * 100)}%`, x, y - 5)

    // ID表示
    const displayId = id ? id.substring(0, 6) : "新規"
    ctx.fillText(`ID: ${displayId}`, x, y - 20)

    // 現在の側を表示
    if (currentSide) {
      ctx.fillText(`側: ${currentSide}`, x, y - 35)
    }

    // 横断情報を表示
    if (hasCrossed) {
      ctx.fillStyle = direction === "right" ? "rgba(0, 255, 0, 0.8)" : "rgba(255, 165, 0, 0.8)"
      ctx.fillText(`${direction === "right" ? "→" : "←"}`, x + width - 15, y - 5)
    }

    // エリア経験状況を表示（デバッグモードのみ）
    if (this.debugMode && trackedPerson) {
      ctx.fillStyle = "yellow"
      ctx.fillText(
        `L:${trackedPerson.hasEnteredLeftSide ? "○" : "×"} R:${trackedPerson.hasEnteredRightSide ? "○" : "×"}`,
        x,
        y + height + 15,
      )
    }
  }

  // 消失した人物の描画
  private drawDisappearedPerson(
    ctx: CanvasRenderingContext2D,
    person: {
      id: string
      box: any
      crossed: boolean
      direction: string | null
      lastPosition: { x: number; y: number }
      positions: Array<{ x: number; y: number; timestamp: number }>
      lastSeen: number
      confidence: number
      crossingConfidence: number
      hasEnteredLeftSide: boolean
      hasEnteredRightSide: boolean
      lastSide: string | null
    },
  ) {
    const [x, y, width, height] = person.box
    const centerX = person.lastPosition.x
    const centerY = person.lastPosition.y
    const timeSinceLastSeen = Date.now() - person.lastSeen
    const opacity = Math.max(0, 1 - timeSinceLastSeen / 1500) // 1.5秒かけて徐々に透明に

    // 消失した人物を薄く表示
    ctx.strokeStyle = `rgba(255, 0, 0, ${opacity * 0.7})`
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, width, height)

    // 中心点を描画
    ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.7})`
    ctx.beginPath()
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2)
    ctx.fill()

    // ID表示
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.7})`
    ctx.font = "12px Arial"
    ctx.fillText(`ID: ${person.id.substring(0, 6)} (消失)`, x, y - 20)
  }

  // 最も近い追跡中の人物を見つける - 改善版
  private findClosestPerson(centerX: number, centerY: number, bbox: number[], confidence: number) {
    const [x, y, width, height] = bbox
    let closestId = null
    let minDistance = Number.MAX_VALUE

    for (const [id, person] of this.trackedPeople.entries()) {
      const [px, py, pwidth, pheight] = person.box
      const pcenterX = px + pwidth / 2
      const pcenterY = py + pheight / 2

      // 中心点間の距離を計算
      const distance = Math.sqrt(Math.pow(centerX - pcenterX, 2) + Math.pow(centerY - pcenterY, 2))

      // サイズの類似性も考慮
      const sizeSimilarity = Math.abs(width * height - pwidth * pheight) / (width * height)

      // 最後に見た時間からの経過時間
      const timeFactor = Math.min(1, (Date.now() - person.lastSeen) / 1000)

      // 総合スコア（距離、サイズ、時間を考慮）
      const score = distance * (1 + sizeSimilarity * 0.3) * (1 + timeFactor * 0.3) // 重み付けを軽減

      // スコアが閾値以下で最小の場合、この人物を選択
      // 閾値を大きくして、より広い範囲で一致を検索
      const threshold = Math.max(width, height) * 1.5 // 1.2から1.5に増加
      if (distance < threshold && score < minDistance) {
        minDistance = score
        closestId = id
      }
    }

    return closestId
  }

  // 横断時の軌跡を描画
  private drawCrossingTrajectory(ctx: CanvasRenderingContext2D, person: any, direction: string) {
    if (person.positions.length < 2) return

    // 軌跡の描画
    ctx.beginPath()
    ctx.moveTo(person.positions[0].x, person.positions[0].y)

    for (let i = 1; i < person.positions.length; i++) {
      ctx.lineTo(person.positions[i].x, person.positions[i].y)
    }

    ctx.strokeStyle = direction === "right" ? "rgba(0, 255, 0, 0.8)" : "rgba(255, 165, 0, 0.8)"
    ctx.lineWidth = 4
    ctx.stroke()

    // 最終位置に大きな点を描画
    const lastPos = person.positions[person.positions.length - 1]
    ctx.fillStyle = "yellow"
    ctx.beginPath()
    ctx.arc(lastPos.x, lastPos.y, 8, 0, Math.PI * 2)
    ctx.fill()

    // 方向矢印を描画
    const arrowLength = 30
    const arrowX = direction === "right" ? lastPos.x + arrowLength : lastPos.x - arrowLength
    this.drawArrow(ctx, lastPos.x, lastPos.y, arrowX, lastPos.y, "yellow")

    // カウント表示
    ctx.fillStyle = "white"
    ctx.font = "16px Arial"
    ctx.fillText(
      direction === "right" ? `→ ${this.peopleCount.leftToRight}` : `← ${this.peopleCount.rightToLeft}`,
      lastPos.x + (direction === "right" ? 10 : -60),
      lastPos.y - 15,
    )
  }

  // 移動軌跡を描画
  private drawMovementPath(
    ctx: CanvasRenderingContext2D,
    lastPosition: { x: number; y: number },
    centerX: number,
    centerY: number,
  ) {
    // 移動距離が小さすぎる場合は描画しない
    const moveDistance = Math.sqrt(Math.pow(centerX - lastPosition.x, 2) + Math.pow(centerY - lastPosition.y, 2))
    if (moveDistance < this.canvasWidth * 0.003) return // 閾値を緩和

    ctx.beginPath()
    ctx.moveTo(lastPosition.x, lastPosition.y)
    ctx.lineTo(centerX, centerY)
    ctx.strokeStyle = "rgba(0, 191, 255, 0.5)"
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 追跡データのクリーンアップ
  private cleanupTrackedPeople() {
    const now = Date.now()
    let cleanupCount = 0

    for (const [id, person] of this.trackedPeople.entries()) {
      // 一定時間検出されなかった人物を削除 - 時間を短縮
      if (now - person.lastSeen > 3000) {
        // 5000msから3000msに短縮
        this.trackedPeople.delete(id)
        cleanupCount++
      }
    }

    if (cleanupCount > 0) {
      console.log(`${cleanupCount}人の追跡データをクリーンアップしました`)
    }
  }

  // カウントのリセット
  resetCount() {
    this.peopleCount = { leftToRight: 0, rightToLeft: 0, total: 0 }

    // 追跡データもリセット
    this.trackedPeople.clear()

    console.log("カウントをリセットしました")

    if (this.onCountUpdate) {
      this.onCountUpdate(this.peopleCount)
    }
  }
}
