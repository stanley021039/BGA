<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import type { MajoritySnapshot } from '../../contracts/majority';
const props = defineProps<{ observer?: MajoritySnapshot }>();
const room = useRoomStore(),
  game = props.observer ? null : useMajorityStore(),
  s = computed(() => props.observer ?? game?.state);
const name = (id: string) => s.value?.players.find((p) => p.id === id)?.name || '待入座';
</script>
<template>
  <div v-if="s?.cruel?.rules === 'teams'" class="vue-majority-teams"
    ><section v-for="team in s.cruel.teams" :key="team.id"
      ><h3
        >{{ team.name }} <span>{{ team.score }} 分</span></h3
      ><p>{{ team.members.map(name).join(' ＋ ') }}</p
      ><label v-if="game?.editable && team.members.length === 2"
        >{{
          name(team.members[0])
        }}
        的搭檔<!-- ui-check-allow raw-control: 保留隊伍欄內的既有搭檔選單。 --><select
          :value="team.members[1]"
          :disabled="room.busy || game.settingsPending || game.uncertain"
          @change="
            game?.act('pair', {
              playerId: team.members[0],
              partnerId: ($event.target as HTMLSelectElement).value,
            })
          "
          ><option
            v-for="player in s.players.filter((p) => p.id !== team.members[0])"
            :key="player.id"
            :value="player.id"
            >{{ player.name }}</option
          ></select
        ></label
      ></section
    ></div
  >
</template>
