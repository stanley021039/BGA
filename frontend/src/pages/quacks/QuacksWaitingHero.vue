<script setup lang="ts">
defineProps<{ artOnly?: boolean }>();
import vector from '../../assets/quacks/vector.svg';
import pot from '../../assets/quacks/pot.svg';
import chips from '../../assets/quacks/chips.svg';
import steam from '../../assets/quacks/steam.svg';
</script>
<template>
  <section
    class="vue-quacks-rq03-hero"
    :aria-labelledby="artOnly ? undefined : 'quacksWaitingTitle'"
    :aria-hidden="artOnly ? true : undefined"
  >
    <div class="vue-quacks-rq03-art" aria-hidden="true">
      <div class="vue-quacks-rq03-art-layers">
        <img class="rq03-vector" :src="vector" alt="" />
        <img class="rq03-pot" :src="pot" alt="" />
        <img class="rq03-chips" :src="chips" alt="" />
        <span class="rq03-number rq03-one">1</span><span class="rq03-number rq03-two">2</span
        ><span class="rq03-number rq03-four">4</span>
        <img class="rq03-steam" :src="steam" alt="" />
      </div>
    </div>
    <div v-if="!artOnly" class="vue-quacks-rq03-copy">
      <small>CLASSIC MODE · 2–8 人一起煮藥</small>
      <h1 id="quacksWaitingTitle">藥袋已備，等房主開釜。</h1>
      <p>九回合同步抽藥，逐色共選本局藥材效果。<br />可加入草藥女巫與煉金術士。</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.vue-quacks-rq03-hero {
  width: 100%;
}
.vue-quacks-rq03-art {
  position: relative;
  container-type: inline-size;
  inline-size: 100%;
  min-inline-size: 0;
  block-size: 170px;
  min-block-size: 170px;
  background: #143e34;
  overflow: hidden;
}
.vue-quacks-rq03-art-layers {
  position: absolute;
  inset-inline-start: 50%;
  inset-block-start: 50%;
  inline-size: 156.926px;
  block-size: 82.5px;
  transform: translate(-50%, -50%);
  > img {
    display: block;
    position: absolute;
    inline-size: auto;
    block-size: auto;
    max-inline-size: none;
    max-block-size: none;
  }
  .rq03-vector {
    left: 16.588px;
    top: 0;
  }
  .rq03-pot {
    left: 42.122px;
    top: 4.843px;
  }
  .rq03-chips {
    left: 65.67px;
    top: 28.875px;
  }
  .rq03-steam {
    left: 54.532px;
    top: 6.806px;
  }
  .rq03-number {
    position: absolute;
    font:
      700 5.775px/1.25 system-ui,
      sans-serif;
    color: #f8ebc0;
    text-align: center;
  }
  .rq03-one {
    left: 69.39px;
    top: 31.56px;
  }
  .rq03-two {
    left: 80.14px;
    top: 29.49px;
  }
  .rq03-four {
    left: 84.58px;
    top: 36.5px;
  }
}
@container (min-width: 200px) {
  .vue-quacks-rq03-art-layers {
    transform: translate(-50%, -50%) scale(1.2);
  }
}
@container (min-width: 260px) {
  .vue-quacks-rq03-art-layers {
    transform: translate(-50%, -50%) scale(1.5);
  }
}
@container (min-width: 400px) {
  .vue-quacks-rq03-art-layers {
    transform: translate(-50%, -50%) scale(2);
  }
}
</style>
