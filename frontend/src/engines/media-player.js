import AudioSettings from './audio-settings.js';
let RoomMediaPlayer;
/* Playback leaf extracted from table-media.js. Vue owns controls and window DOM.
 * Native audio intent/proof classification is preserved, including visibility recovery.
 * Loading this file creates no player, iframe, UI, network request or event listener. */
(() => {
  'use strict';
  function create(options) {
    const { audioHost, videoHost } = options,
      maxPosition = 14400,
      clock = () => performance.now();
    let document = videoHost.ownerDocument || globalThis.document,
      window = document.defaultView || globalThis.window;
    const retiredPlayers = new WeakSet(),
      audioTransitions = new WeakMap();
    let audioPreviewGesture = null,
      videoReadyJob = null,
      initialVideoPause = null,
      videoHasStarted = false;
    let snapshot = null,
      marker = null,
      room = null,
      serverAt = 0,
      observedAt = 0,
      playerEpoch = 0,
      audio = null,
      interruptedAudio = null,
      player = null,
      ready = false,
      nativeVideo = false,
      videoFallback = false,
      mountingVideo = null,
      videoWanted = false,
      unlocked = false,
      appliedPlayback = null,
      positionRead = null,
      apiPromise = null,
      apiScript = null,
      apiTimer = null,
      apiCancel = null,
      intersection = null,
      opened = false,
      backgroundVideo = false,
      keepVideoPlaying = false,
      collapsed = false,
      disposed = false;
    const status = (message) => {
      if (!disposed) options.onStatus(message);
    };
    const markerKey = (value) => (value ? `${value.roomInstanceId}:${value.revision}` : '');
    const currentKey = () =>
      snapshot?.current
        ? `${snapshot.roomInstanceId}:${snapshot.playbackSessionId}:${snapshot.current.id}`
        : null;
    const report = (action, extra) => {
      if (!disposed && room) options.onReport(action, extra);
    };
    function duration() {
      return Number.isFinite(snapshot?.current?.durationSec) ? snapshot.current.durationSec : 0;
    }
    function position() {
      if (!snapshot?.current) return 0;
      const playback = snapshot.playback;
      return Math.max(
        0,
        Math.min(
          duration() || maxPosition,
          playback.anchorPositionSec +
            (playback.state === 'playing'
              ? Math.max(0, serverAt + clock() - observedAt - playback.anchorServerMs) / 1000
              : 0),
        ),
      );
    }
    function signature() {
      return snapshot
        ? JSON.stringify([
            currentKey(),
            snapshot.playback.state,
            snapshot.playback.anchorPositionSec,
            snapshot.playback.anchorServerMs,
          ])
        : null;
    }
    function validPlayer(token, key, allowHidden = false) {
      return (
        !disposed &&
        token === playerEpoch &&
        key === currentKey() &&
        !!room &&
        (allowHidden || !document.hidden)
      );
    }
    function notify() {
      let videoTitle = '';
      try {
        const data = ready && player?.getVideoData?.();
        if (data?.video_id === snapshot?.current?.videoId && typeof data.title === 'string')
          videoTitle = data.title
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .trim()
            .slice(0, 500);
      } catch {
        /* Metadata is optional; playback must continue. */
      }
      if (!disposed)
        options.onChange({
          videoWanted,
          ready,
          nativeVideo,
          videoFallback,
          loading: mountingVideo !== null || videoReadyJob !== null,
          publishReason: publishReason(),
          videoTitle,
          videoTitleId: videoTitle ? snapshot?.current?.videoId : '',
        });
    }
    function stopAudio() {
      const old = audio;
      audio = null;
      interruptedAudio = null;
      if (!old) return;
      old.onloadedmetadata = null;
      old.onended = null;
      old.onerror = null;
      old.onplaying = null;
      old._mediaUnbind?.();
      try {
        pauseAudio(old);
        old.removeAttribute('src');
        old.load();
      } catch {}
      audioHost.replaceChildren();
    }
    function cancelVideoReady(target) {
      if (!videoReadyJob || (target && videoReadyJob.player !== target)) return;
      clearTimeout(videoReadyJob.timer);
      videoReadyJob = null;
    }
    function retirePlayer(old) {
      if (!old || retiredPlayers.has(old)) return;
      cancelVideoReady(old);
      retiredPlayers.add(old);
      try {
        old.pauseVideo();
        old.destroy();
      } catch {}
    }
    function destroyVideo() {
      cancelVideoReady();
      initialVideoPause = null;
      videoHasStarted = false;
      ready = false;
      nativeVideo = false;
      intersection?.disconnect();
      intersection = null;
      const old = player;
      player = null;
      retirePlayer(old);
      videoHost.replaceChildren();
    }
    function cancelPositionRead() {
      const job = positionRead;
      positionRead = null;
      if (job) {
        clearTimeout(job.timer);
        job.cancel?.();
      }
    }
    function stopPlayers() {
      cancelPositionRead();
      playerEpoch++;
      appliedPlayback = null;
      mountingVideo = null;
      videoFallback = false;
      stopAudio();
      destroyVideo();
      apiCancel?.();
    }
    function activeVideo() {
      return (
        !disposed &&
        snapshot?.current?.type === 'video' &&
        videoWanted &&
        (opened || backgroundVideo)
      );
    }
    function isVisibleEnough() {
      if (collapsed || keepVideoPlaying) return true;
      const box = videoHost.getBoundingClientRect();
      if (box.width < 200 || box.height < 200) return false;
      let left = Math.max(0, box.left),
        right = Math.min(window.innerWidth || innerWidth, box.right),
        top = Math.max(0, box.top),
        bottom = Math.min(window.innerHeight || innerHeight, box.bottom);
      for (let parent = videoHost.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent),
          rect = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX || style.overflow || '')) {
          left = Math.max(left, rect.left);
          right = Math.min(right, rect.right);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY || style.overflow || '')) {
          top = Math.max(top, rect.top);
          bottom = Math.min(bottom, rect.bottom);
        }
      }
      return Math.max(0, right - left) * Math.max(0, bottom - top) > box.width * box.height * 0.5;
    }
    function observeFrame(iframe, token, key) {
      intersection?.disconnect();
      if (typeof IntersectionObserver === 'function') {
        intersection = new IntersectionObserver(
          (entries) => {
            if (
              validPlayer(token, key) &&
              activeVideo() &&
              !collapsed &&
              !keepVideoPlaying &&
              entries.some((entry) => entry.intersectionRatio <= 0.5)
            )
              exitVideo('影片已離開可見範圍，需要時再加入觀看。');
          },
          { threshold: [0.5] },
        );
        intersection.observe(iframe);
      }
    }
    function exitVideo(message = '影片已關閉。') {
      videoWanted = false;
      playerEpoch++;
      appliedPlayback = null;
      mountingVideo = null;
      destroyVideo();
      apiCancel?.();
      notify();
      if (message) status(message);
    }
    function settings(value = AudioSettings?.get?.()) {
      if (!value) return;
      const music = value.music;
      if (audio) {
        audio.volume = music.volume;
        audio.muted = !music.enabled;
      }
      if (player && ready)
        try {
          player.setVolume(music.volume * 100);
          music.enabled && !initialVideoPause ? player.unMute() : player.mute();
        } catch {}
    }
    function expectAudioTransition(clip, type, front = false) {
      const record = audioTransitions.get(clip);
      if (!record) return;
      front ? record.expected.unshift(type) : record.expected.push(type);
      if (record.expected.length > 64) {
        record.expected.shift();
        record.skipped = Math.min(65536, record.skipped + 1);
        record.intent++;
        record.nativePaused = null;
        if (interruptedAudio?.clip === clip) interruptedAudio = null;
      }
    }
    function invokeAudio(clip, type) {
      const record = audioTransitions.get(clip);
      if (record) record.issuing++;
      try {
        return clip[type]();
      } finally {
        if (record) record.issuing--;
      }
    }
    function pauseAudio(clip, proof) {
      const paused = clip.paused;
      invokeAudio(clip, 'pause');
      if (!paused && clip.paused) {
        if (proof) proof.issued = true;
        else expectAudioTransition(clip, 'pause');
      }
    }
    function playAudio(clip, proof) {
      const paused = clip.paused,
        record = audioTransitions.get(clip);
      if (record) record.nativePaused = false;
      const result = invokeAudio(clip, 'play');
      if (paused && !clip.paused) {
        if (proof) proof.issued = true;
        else expectAudioTransition(clip, 'play');
      }
      return result;
    }
    function cancelAudioProof(record) {
      if (record?.proof) {
        record.proof.cancelled = true;
        record.proof.flow.closed = true;
      }
    }
    function failAudioProof(clip, record) {
      cancelAudioProof(record);
      record.intent++;
      record.nativePaused = true;
      if (interruptedAudio?.clip === clip) interruptedAudio = null;
      pauseAudio(clip);
      status('這裡保持暫停，請用原生播放按鈕繼續。', true);
    }
    function createAudioProof(clip, record, kind, flow, purpose) {
      const previous = record.proof;
      if (previous?.predecessors.size >= 7) {
        failAudioProof(clip, record);
        return null;
      }
      const events = previous ? previous.events.splice(0) : [],
        excluded = previous ? previous.excluded : new Set(),
        predecessors = previous ? previous.predecessors : new Set();
      if (previous) {
        cancelAudioProof(record);
        previous.excluded = new Set();
        previous.predecessors = new Set();
        predecessors.add(previous);
      }
      const proof = {
        kind,
        intent: record.intent,
        events,
        excluded,
        predecessors,
        issued: false,
        cancelled: false,
        overflow: false,
        flow,
        purpose,
      };
      record.proof = proof;
      return proof;
    }
    function finishAudioProof(clip, record, proof, error) {
      if (!proof) return false;
      if (record?.proof !== proof) {
        const current = record?.proof;
        if (!record?.disposed && clip === audio && current?.predecessors.has(proof)) {
          if (proof.issued && proof.kind === 'pause' && !error)
            expectAudioTransition(clip, 'pause', true);
          else if (proof.issued && (proof.kind === 'play' || error?.name === 'AbortError')) {
            const owned = current.events.findLast(
              (event) =>
                event.type === (proof.kind === 'pause' ? 'pause' : 'play') &&
                !current.excluded.has(event),
            );
            if (owned) current.excluded.add(owned);
          }
          current.predecessors.delete(proof);
        }
        proof.events.length = 0;
        proof.excluded.clear();
        proof.predecessors.clear();
        return false;
      }
      record.proof = null;
      const pause = proof.kind === 'pause',
        abort = error?.name === 'AbortError';
      const owned =
        proof.issued && (!pause || abort)
          ? proof.events.findLastIndex((event) => event.type === (pause ? 'pause' : 'play'))
          : -1;
      // A successful play promise settles in notify-playing; AbortError settles in
      // the later pause task. Both fence the preceding events of this same element.
      // An already-playing play() checkpoints the media queue before our subsequent
      // pause task. At low readyState its AbortError instead checkpoints that task.
      if (pause && proof.issued && !error && !record.disposed && clip === audio)
        expectAudioTransition(clip, 'pause', true);
      const classified =
        !record.disposed &&
        clip === audio &&
        !proof.overflow &&
        record.intent === proof.intent &&
        (!pause || !error || abort);
      if (classified) {
        for (let index = 0; index < proof.events.length; index++)
          if (index !== owned && !proof.excluded.has(proof.events[index])) {
            const event = proof.events[index];
            proof.nativeObserved = true;
            proof.nativePlay = event.type === 'play' ? event : null;
            record.intent++;
            record.nativePaused = event.type === 'pause';
          }
      }
      proof.classified = classified;
      proof.events.length = 0;
      proof.excluded.clear();
      proof.predecessors.clear();
      return classified && !proof.cancelled && !proof.flow.closed;
    }
    function correctAudioPause(clip, record, token, key, flow, purpose = 'correction') {
      if (clip.ended === true) {
        if (purpose === 'visibility' && interruptedAudio?.clip === clip) interruptedAudio = null;
        pauseAudio(clip);
        return;
      }
      if (flow.closed || flow.corrections >= 8) {
        flow.closed = true;
        failAudioProof(clip, record);
        return;
      }
      if (purpose === 'correction') flow.corrections++;
      const proof = createAudioProof(clip, record, 'pause', flow, purpose);
      if (!proof) return;
      const finish = (error) => {
        const valid = finishAudioProof(clip, record, proof, error);
        if (purpose === 'visibility') {
          if (valid && proof.nativePlay) {
            record.confirmedPlay = proof.nativePlay;
            try {
              record.previewPlay?.(proof.nativePlay);
            } finally {
              record.confirmedPlay = null;
            }
          }
          const interrupted = interruptedAudio;
          if (
            proof.classified &&
            interrupted?.clip === clip &&
            interrupted.key === key &&
            interrupted.token === token &&
            interrupted.intent === proof.intent
          ) {
            if (proof.nativeObserved && record.nativePaused === true) interruptedAudio = null;
            else interrupted.intent = record.intent;
          }
          resumeInterruptedAudio();
          return;
        }
        if (
          valid &&
          validPlayer(token, key) &&
          clip === audio &&
          clip.paused &&
          record.nativePaused === false &&
          snapshot?.playback.state === 'playing' &&
          AudioSettings?.get?.().music.enabled &&
          unlocked
        ) {
          interruptedAudio = { clip, key, token, intent: record.intent, flow, keepPosition: true };
          resumeInterruptedAudio();
        }
      };
      try {
        const checkpoint = invokeAudio(clip, 'play');
        pauseAudio(clip, proof);
        Promise.resolve(checkpoint).then(() => finish(), finish);
      } catch (error) {
        pauseAudio(clip);
        finish(error);
      }
    }
    function bindAudioIntent(clip) {
      const record = {
          expected: [],
          skipped: 0,
          intent: 0,
          nativePaused: false,
          owned: new WeakSet(),
          disposed: false,
          issuing: 0,
          proof: null,
        },
        listeners = [],
        previewListeners = new Map(),
        methods = [];
      audioTransitions.set(clip, record);
      const listen = (type, callback, capture = false) => {
        clip.addEventListener(type, callback, capture);
        listeners.push(() => clip.removeEventListener(type, callback, capture));
      };
      const invalidate = () => {
        if (record.disposed || clip !== audio) return;
        record.intent++;
        record.nativePaused = null;
        cancelAudioProof(record);
        if (interruptedAudio?.clip === clip) interruptedAudio = null;
      };
      // External JS controls can express a newer choice before their media events.
      // UA controls still use the queued-event proof below; these wrappers do not
      // substitute for input capture or assume that native UI calls JS methods.
      for (const type of ['play', 'pause']) {
        const original = clip[type],
          descriptor = Object.getOwnPropertyDescriptor(clip, type);
        const wrapped = function (...args) {
          const external = this === clip && !record.disposed && !record.issuing;
          if (external) {
            invalidate();
            record.nativePaused = type === 'pause';
          }
          return original.apply(this, args);
        };
        try {
          Object.defineProperty(clip, type, { configurable: true, writable: true, value: wrapped });
          methods.push(() => {
            if (clip[type] === wrapped) {
              if (descriptor) Object.defineProperty(clip, type, descriptor);
              else delete clip[type];
            }
          });
        } catch {}
      }
      const transition = (event) => {
        if (record.disposed || clip !== audio) return;
        if (record.skipped) {
          record.skipped--;
          record.owned.add(event);
          return;
        }
        if (record.expected[0] === event.type) {
          record.expected.shift();
          record.owned.add(event);
          return;
        }
        if (record.proof) {
          const proof = record.proof;
          record.owned.add(event);
          if (proof.events.length < 64) proof.events.push(event);
          else if (!proof.overflow) {
            proof.overflow = true;
            failAudioProof(clip, record);
          }
          return;
        }
        invalidate();
        record.nativePaused = event.type === 'pause';
      };
      // Browser media events are queued after the state transition. Register before bindPreview.
      listen('play', transition);
      listen('pause', transition);
      listen('pointerdown', invalidate, true);
      listen('keydown', invalidate, true);
      const preview = {
        get volume() {
          return clip.volume;
        },
        set volume(value) {
          clip.volume = value;
        },
        get muted() {
          return clip.muted;
        },
        set muted(value) {
          clip.muted = value;
        },
        addEventListener(type, callback) {
          const wrapped = (event) => {
            if (
              record.disposed ||
              (type === 'play' &&
                record.confirmedPlay !== event &&
                (record.owned.has(event) || clip.paused))
            )
              return;
            const previous = audioPreviewGesture;
            audioPreviewGesture = clip;
            try {
              callback.call(clip, event);
            } finally {
              audioPreviewGesture = previous;
            }
          };
          if (type === 'play') record.previewPlay = wrapped;
          previewListeners.set(callback, { type, wrapped });
          clip.addEventListener(type, wrapped);
        },
        removeEventListener(type, callback) {
          const registered = previewListeners.get(callback);
          if (registered) {
            clip.removeEventListener(registered.type, registered.wrapped);
            previewListeners.delete(callback);
          }
        },
      };
      const unbind = AudioSettings?.bindPreview?.(preview);
      return () => {
        record.disposed = true;
        record.previewPlay = null;
        record.confirmedPlay = null;
        if (record.proof) {
          cancelAudioProof(record);
          record.proof.events.length = 0;
          record.proof.excluded.clear();
          record.proof.predecessors.clear();
          record.proof = null;
        }
        unbind?.();
        for (const remove of listeners) remove();
        for (const restore of methods) restore();
        for (const { type, wrapped } of previewListeners.values())
          clip.removeEventListener(type, wrapped);
        previewListeners.clear();
        record.expected.length = 0;
        audioTransitions.delete(clip);
      };
    }
    function alignAudio(force = false, interrupted = null, keepPosition = false) {
      const clip = audio,
        key = currentKey(),
        token = playerEpoch,
        record = audioTransitions.get(clip),
        intent = record?.intent;
      if (!clip || snapshot?.current?.type !== 'music') return;
      const desired = position();
      if (
        !keepPosition &&
        clip.readyState >= 1 &&
        (force || Math.abs(clip.currentTime - desired) > 1.25)
      )
        try {
          clip.currentTime = desired;
        } catch {}
      const preferences = AudioSettings?.get?.().music;
      if (
        snapshot.playback.state !== 'playing' ||
        !preferences?.enabled ||
        !unlocked ||
        document.hidden
      ) {
        pauseAudio(clip);
        return;
      }
      if (!clip.paused || clip._mediaPlayPending) return;
      const flow = interrupted?.flow || { corrections: 0, closed: false },
        needsProof = record && (interrupted || record.proof),
        proof = needsProof ? createAudioProof(clip, record, 'play', flow) : null;
      if (needsProof && !proof) return;
      clip._mediaPlayPending = true;
      try {
        Promise.resolve(playAudio(clip, proof))
          .then(
            () => {
              const reconciled = finishAudioProof(clip, record, proof);
              if (
                !validPlayer(token, key) ||
                clip !== audio ||
                snapshot?.playback.state !== 'playing' ||
                !AudioSettings?.get?.().music.enabled
              )
                pauseAudio(clip);
              else if (record?.intent !== intent && record?.nativePaused === true) {
                if (reconciled && !clip.paused) correctAudioPause(clip, record, token, key, flow);
                else pauseAudio(clip);
              } else status('', true);
            },
            (error) => {
              finishAudioProof(clip, record, proof, error);
              if (error?.name === 'AbortError') return;
              const interrupted = interruptedAudio;
              if (
                interrupted?.clip === clip &&
                interrupted.key === key &&
                interrupted.token === token &&
                interrupted.intent === intent
              )
                interruptedAudio = null;
              if (validPlayer(token, key) && clip === audio)
                status('瀏覽器尚未允許音樂播放，請按「在自己的裝置播放」或原生播放按鈕。', true);
            },
          )
          .finally(() => {
            clip._mediaPlayPending = false;
            if (clip === audio && token === playerEpoch && key === currentKey())
              resumeInterruptedAudio();
          });
      } catch {
        finishAudioProof(clip, record, proof);
        clip._mediaPlayPending = false;
        status('請按原生音樂播放器的播放按鈕重試。', true);
      }
    }
    // Undo only our visibility pause; a newer room marker must first get its existing snapshot reply.
    function resumeInterruptedAudio() {
      const interrupted = interruptedAudio;
      if (!interrupted || document.hidden) return;
      if (
        interrupted.clip !== audio ||
        !validPlayer(interrupted.token, interrupted.key) ||
        interrupted.intent !== audioTransitions.get(audio)?.intent
      ) {
        interruptedAudio = null;
        return;
      }
      if (markerKey(snapshot) !== markerKey(marker)) return;
      if (audioTransitions.get(audio)?.proof?.kind === 'pause') return;
      if (
        snapshot?.playback.state !== 'playing' ||
        !AudioSettings?.get?.().music.enabled ||
        !unlocked
      ) {
        interruptedAudio = null;
        return;
      }
      // A native Play has already superseded our pause; retain its local position.
      if (!audio.paused) {
        interruptedAudio = null;
        return;
      }
      // pause's queued task may still be rejecting the old play promise when visibility returns.
      if (audio._mediaPlayPending) return;
      interruptedAudio = null;
      alignAudio(false, interrupted, !!interrupted.keepPosition);
    }
    function mountAudio() {
      stopPlayers();
      if (snapshot?.current?.type !== 'music') return;
      const key = currentKey(),
        token = playerEpoch,
        clip = new Audio();
      audio = clip;
      clip.controls = true;
      clip.preload = 'metadata';
      clip.setAttribute('aria-label', '本機歌曲播放器');
      clip.src = '/assets/music/' + encodeURIComponent(snapshot.current.trackId);
      audioHost.append(clip);
      settings();
      clip._mediaUnbind = bindAudioIntent(clip);
      clip.onloadedmetadata = () => {
        if (validPlayer(token, key) && clip === audio) {
          alignAudio(true);
          notify();
        }
      };
      clip.onended = () => {
        if (validPlayer(token, key) && clip === audio)
          report('ended', { itemId: snapshot.current.id });
      };
      clip.onerror = () => {
        if (validPlayer(token, key) && clip === audio)
          status('這首歌曲暫時無法播放，可用原生播放器重試或請管理者切下一筆。', true);
      };
      clip.load();
      alignAudio(true);
    }
    function youtubeApi() {
      const apiWindow = window,
        apiDocument = document;
      if (apiWindow.YT?.Player) return Promise.resolve(apiWindow.YT);
      if (apiPromise) return apiPromise;
      apiPromise = new Promise((resolve, reject) => {
        const previous = apiWindow.onYouTubeIframeAPIReady;
        let complete = false;
        const finish = () => {
          if (apiTimer !== null) clearTimeout(apiTimer);
          apiTimer = null;
          apiCancel = null;
          if (apiWindow.onYouTubeIframeAPIReady === done)
            apiWindow.onYouTubeIframeAPIReady = previous;
        };
        const fail = () => {
          if (complete) return;
          complete = true;
          finish();
          apiScript?.remove();
          apiScript = null;
          apiPromise = null;
          reject(Error('YouTube播放器未能載入，請使用原生播放器或重試。'));
        };
        const done = () => {
          if (complete) return;
          if (!apiWindow.YT?.Player) {
            fail();
            return;
          }
          complete = true;
          finish();
          try {
            previous?.();
          } catch {}
          resolve(apiWindow.YT);
        };
        apiCancel = fail;
        apiWindow.onYouTubeIframeAPIReady = done;
        apiScript = apiDocument.createElement('script');
        apiScript.src = 'https://www.youtube.com/iframe_api';
        apiScript.referrerPolicy = 'strict-origin-when-cross-origin';
        apiScript.onerror = fail;
        apiTimer = setTimeout(fail, 20000);
        apiDocument.head.append(apiScript);
      });
      return apiPromise;
    }
    function videoFrame(videoId, api = true, embedHost = 'www.youtube-nocookie.com') {
      const iframe = document.createElement('iframe');
      iframe.title = '本桌YouTube影片';
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.src =
        'https://' +
        embedHost +
        '/embed/' +
        encodeURIComponent(videoId) +
        '?controls=1&playsinline=1' +
        (api ? '&enablejsapi=1&origin=' + encodeURIComponent(location.origin) : '');
      return iframe;
    }
    function applyVideo(force = false) {
      if (document.hidden) return;
      if (!activeVideo() || !ready || !player || nativeVideo) return;
      const key = signature();
      if (!force && appliedPlayback === key) return;
      if (!isVisibleEnough()) {
        exitVideo('播放器空間不足，請放大視窗後重新加入。');
        return;
      }
      appliedPlayback = key;
      // An untouched iframe needs real media data before it can retain a paused frame.
      // Bootstrap silently, then pause once in its first current PLAYING callback.
      initialVideoPause = null;
      try {
        if (snapshot.playback.state === 'paused' && !videoHasStarted) {
          initialVideoPause = { epoch: playerEpoch, key: currentKey(), playback: key, player };
          player.mute();
          player.loadVideoById({ videoId: snapshot.current.videoId, startSeconds: position() });
        } else {
          settings();
          if (snapshot.playback.state === 'paused') {
            player.pauseVideo();
            player.seekTo(position(), true);
            player.pauseVideo();
          } else {
            player.seekTo(position(), true);
            player.playVideo();
          }
        }
      } catch {
        initialVideoPause = null;
        settings();
        status('影片尚未準備好，請按「返回全桌進度」或原生播放按鈕。', true);
      }
    }
    async function mountVideo(embedHost = 'www.youtube-nocookie.com') {
      if (document.hidden) return;
      stopPlayers();
      if (!activeVideo()) return;
      const token = playerEpoch,
        key = currentKey(),
        videoId = snapshot.current.videoId;
      mountingVideo = token;
      status('載入自己的YouTube播放器…', true);
      notify();
      try {
        const yt = await youtubeApi();
        if (!validPlayer(token, key) || !activeVideo()) return;
        if (!isVisibleEnough()) {
          exitVideo('影片至少需要200×200可見空間，請放大視窗後重新加入。');
          return;
        }
        const iframe = videoFrame(videoId, true, embedHost);
        videoHost.replaceChildren(iframe);
        const valid = () => validPlayer(token, key, true) && activeVideo();
        let instance;
        const stale = (target) => {
          if (valid()) return false;
          retirePlayer(target);
          return true;
        };
        instance = new yt.Player(iframe, {
          events: {
            onReady: (event) => {
              if (stale(event?.target || instance)) return;
              cancelVideoReady(event?.target || instance);
              ready = true;
              videoFallback = false;
              status('', true);
              settings();
              applyVideo(true);
              notify();
              const length = Number(instance.getDuration?.());
              if (Number.isFinite(length) && length > 0 && length <= maxPosition && !duration())
                report('duration', { itemId: snapshot.current.id, durationSec: length });
            },
            onStateChange: (event) => {
              if (stale(event.target || instance)) return;
              if (event.data === 0) {
                initialVideoPause = null;
                settings();
                status('這裡已播放完畢，等待下一筆。', true);
                report('ended', { itemId: snapshot.current.id });
              } else if (event.data === 3) status('影片正在緩衝。', true);
              else if (event.data === 1) {
                videoHasStarted = true;
                const pending = initialVideoPause;
                initialVideoPause = null;
                if (
                  pending &&
                  pending.epoch === playerEpoch &&
                  pending.key === currentKey() &&
                  pending.playback === signature() &&
                  pending.player === player &&
                  snapshot.playback.state === 'paused'
                ) {
                  try {
                    player.pauseVideo();
                  } catch {}
                }
                if (pending) settings();
                status('', true);
                const length = Number(instance.getDuration?.());
                if (Number.isFinite(length) && length > 0 && length <= maxPosition && !duration())
                  report('duration', { itemId: snapshot.current.id, durationSec: length });
              }
              notify();
            },
            onAutoplayBlocked: (event) => {
              if (stale(event?.target || instance)) return;
              initialVideoPause = null;
              settings();
              status('瀏覽器需要你允許播放，請按「在自己的裝置播放」或YouTube原生播放按鈕。', true);
            },
            onError: (event) => {
              if (stale(event.target || instance)) return;
              cancelVideoReady(event.target || instance);
              initialVideoPause = null;
              settings();
              if (
                [101, 150, 153].includes(event.data) &&
                embedHost === 'www.youtube-nocookie.com'
              ) {
                status('YouTube回報錯誤 ' + event.data + '，正在以一般嵌入播放器重試。');
                Promise.resolve().then(() => {
                  if (valid()) mountVideo('www.youtube.com');
                });
                return;
              }
              const errors = {
                2: '影片識別碼無效。',
                5: '此瀏覽器無法播放這部影片。',
                100: '影片不存在、已移除或是私人影片。',
                101: '影片不允許嵌入觀看。',
                150: '影片不允許嵌入觀看。',
                153: 'YouTube未能確認網站來源。',
              };
              status(
                (errors[event.data] || '影片目前無法嵌入播放。') +
                  '（YouTube錯誤 ' +
                  event.data +
                  '）可用原生播放器重試，或至YouTube觀看。',
                true,
              );
              videoFallback = true;
              notify();
            },
          },
        });
        if (!valid()) {
          stale(instance);
          return;
        }
        player = instance;
        if (!ready && !videoFallback) {
          const job = { player: instance, timer: null };
          videoReadyJob = job;
          job.timer = setTimeout(() => {
            if (videoReadyJob !== job) return;
            videoReadyJob = null;
            if (!valid() || player !== instance || ready) return;
            videoFallback = true;
            status('YouTube播放器回應逾時，請重新載入，或使用原生影片播放器。', true);
            notify();
          }, 20000);
        }
        observeFrame(iframe, token, key);
      } catch (error) {
        if (validPlayer(token, key) && activeVideo()) {
          status(error.message, true);
          videoFallback = true;
          notify();
        }
      } finally {
        if (mountingVideo === token) {
          mountingVideo = null;
          notify();
        }
      }
    }
    function applyPlayback(force = false) {
      if (!snapshot?.current) {
        stopPlayers();
        notify();
        return;
      }
      if (snapshot.current.type === 'music') {
        if (!audio) mountAudio();
        else {
          if (force || appliedPlayback !== signature()) {
            appliedPlayback = signature();
            alignAudio(true);
          }
        }
      } else if (activeVideo()) {
        if (!player && !nativeVideo && mountingVideo !== playerEpoch) mountVideo();
        else applyVideo(force);
      }
    }

    function publishReason() {
      if (!snapshot?.current) return '目前沒有可同步的媒體。';
      if (positionRead) return '正在讀取自己的播放進度。';
      if (snapshot.current.type === 'music')
        return audio && audio.readyState >= 1 ? '' : '歌曲尚未準備好，暫時無法同步進度。';
      if (nativeVideo) return '原生影片播放器無法讀取播放進度。';
      return activeVideo() && ready && typeof player?.getCurrentTime === 'function'
        ? ''
        : '影片尚未準備好，暫時無法同步進度。';
    }
    function validPositionRead(job) {
      return (
        !disposed &&
        job === positionRead &&
        validPlayer(job.epoch, job.key) &&
        opened &&
        snapshot?.canControl &&
        job.revision === snapshot.revision &&
        job.playback === signature() &&
        job.provider === (snapshot.current.type === 'music' ? audio : player) &&
        (snapshot.current.type === 'music'
          ? audio?.readyState >= 1
          : ready && !nativeVideo && activeVideo())
      );
    }
    async function readPosition() {
      if (!opened || document.hidden || !snapshot?.canControl || publishReason()) return null;
      const job = {
        epoch: playerEpoch,
        key: currentKey(),
        revision: snapshot.revision,
        playback: signature(),
        provider: snapshot.current.type === 'music' ? audio : player,
        timer: null,
      };
      positionRead = job;
      notify();
      try {
        const value = await new Promise((resolve, reject) => {
          job.cancel = () => resolve(undefined);
          job.timer = setTimeout(() => {
            job.timedOut = true;
            resolve(undefined);
          }, 2000);
          try {
            Promise.resolve(
              snapshot.current.type === 'music'
                ? job.provider.currentTime
                : job.provider.getCurrentTime(),
            ).then(resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
        if (!validPositionRead(job)) return null;
        if (job.timedOut) {
          status('未能讀取播放器進度，請重試。');
          return null;
        }
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > maxPosition ||
          (duration() && value > duration())
        ) {
          status('播放器尚未提供有效播放進度，請稍後重試。');
          return null;
        }
        return value;
      } catch {
        if (validPositionRead(job)) status('未能讀取播放器進度，請重試。');
        return null;
      } finally {
        clearTimeout(job.timer);
        if (positionRead === job) {
          positionRead = null;
          notify();
        }
      }
    }
    function visibility() {
      if (document.hidden) {
        cancelPositionRead();
        if (audio) {
          const record = audioTransitions.get(audio);
          if (
            !audio.paused ||
            (audio._mediaPlayPending && record?.nativePaused !== true && !record?.proof?.cancelled)
          )
            interruptedAudio = {
              clip: audio,
              key: currentKey(),
              token: playerEpoch,
              intent: record?.intent,
            };
          cancelAudioProof(record);
          if (!audio.paused && record)
            correctAudioPause(
              audio,
              record,
              playerEpoch,
              currentKey(),
              { corrections: 0, closed: false },
              'visibility',
            );
          else pauseAudio(audio);
        }
        // A tab switch must not destroy an already accepted YouTube player.
      } else {
        resumeInterruptedAudio();
        if (activeVideo()) applyPlayback();
      }
    }
    const unbind = AudioSettings?.subscribe?.((value, { gesture = false } = {}) => {
      settings(value);
      if (audio && !value.music.enabled) cancelAudioProof(audioTransitions.get(audio));
      if (gesture) unlocked = true;
      if (audio && audioPreviewGesture === audio) {
        if (document.hidden || snapshot?.playback.state !== 'playing' || !value.music.enabled)
          pauseAudio(audio);
        return;
      }
      alignAudio();
    });
    document.addEventListener('visibilitychange', visibility);
    function disconnect() {
      room = null;
      stopPlayers();
      snapshot = null;
      marker = null;
      videoWanted = false;
      status('');
      notify();
    }
    function dispose() {
      if (disposed) return;
      disconnect();
      disposed = true;
      unbind?.();
      document.removeEventListener('visibilitychange', visibility);
      apiScript?.remove();
      apiScript = null;
    }
    return {
      relocate() {
        const target = videoHost.ownerDocument || globalThis.document;
        if (disposed || target === document) return;
        document.removeEventListener('visibilitychange', visibility);
        apiCancel?.();
        apiScript?.remove();
        apiScript = apiPromise = null;
        document = target;
        window = target.defaultView || globalThis.window;
        document.addEventListener('visibilitychange', visibility);
        // HTML audio survives adoption; keep its native intent and position.
        // Cross-document iframes reset, so rebind YouTube in the new realm at
        // the authoritative shared position, never with a second audio stream.
        if (snapshot?.current?.type === 'video' && videoWanted) {
          const wasNative = nativeVideo;
          stopPlayers();
          if (wasNative) {
            nativeVideo = true;
            const iframe = videoFrame(snapshot.current.videoId, false);
            videoHost.replaceChildren(iframe);
            observeFrame(iframe, playerEpoch, currentKey());
          } else if (!document.hidden) void mountVideo();
        } else if (audio) alignAudio(false);
        notify();
      },
      update(next, nextMarker, now) {
        if (disposed) return;
        const old = currentKey(),
          previous = signature();
        if (positionRead && positionRead.revision !== next.revision) cancelPositionRead();
        snapshot = next;
        marker = nextMarker;
        room = { me: next.myPlayerId };
        observedAt = clock();
        serverAt = now;
        if (old !== currentKey()) stopPlayers();
        if (old !== currentKey() || previous !== signature()) applyPlayback(true);
        resumeInterruptedAudio();
        notify();
      },
      setMarker(value) {
        marker = value;
      },
      setWindow(value, bar = false, keepVideo = false) {
        if (disposed) return;
        const was = opened;
        opened = value;
        backgroundVideo = !value && keepVideo;
        keepVideoPlaying = keepVideo;
        collapsed = bar || backgroundVideo;
        if (!value) {
          cancelPositionRead();
          if (!keepVideo && snapshot?.current?.type === 'video') exitVideo('');
        } else if (!was && activeVideo()) applyPlayback();
        notify();
      },
      joinVideo() {
        if (disposed) return;
        videoWanted = true;
        unlocked = true;
        if (activeVideo()) mountVideo();
        notify();
      },
      exitVideo,
      resume() {
        if (disposed) return;
        unlocked = true;
        AudioSettings?.set('music', { enabled: true }, { gesture: true });
        if (audio) alignAudio(false);
        if (activeVideo() && player && ready)
          try {
            initialVideoPause = null;
            settings();
            player.playVideo();
          } catch {
            status('請直接按YouTube播放器的播放按鈕。');
          }
      },
      align() {
        if (disposed) return;
        unlocked = true;
        applyPlayback(true);
        notify();
      },
      useNativeVideo() {
        if (!activeVideo() || !isVisibleEnough()) return;
        cancelPositionRead();
        playerEpoch++;
        destroyVideo();
        apiCancel?.();
        mountingVideo = null;
        nativeVideo = true;
        const iframe = videoFrame(snapshot.current.videoId, false);
        videoHost.replaceChildren(iframe);
        observeFrame(iframe, playerEpoch, currentKey());
        status('已切換為原生播放器。');
        notify();
      },
      readPosition,
      disconnect,
      dispose,
    };
  }
  RoomMediaPlayer = { create };
})();

export default RoomMediaPlayer;
