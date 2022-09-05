import { Mesh } from 'three'

import { executeCommand } from '@xrengine/editor/src/classes/History'
import { CommandFuncType, CommandParams, MiscCommands } from '@xrengine/editor/src/constants/EditorCommands'
import arrayShallowEqual from '@xrengine/editor/src/functions/arrayShallowEqual'
import { serializeObject3DArray, serializeProperties } from '@xrengine/editor/src/functions/debug'
import { EditorAction } from '@xrengine/editor/src/services/EditorServices'
import { SelectionAction } from '@xrengine/editor/src/services/SelectionServices'
import obj3dFromUuid from '@xrengine/engine/src/scene/util/obj3dFromUuid'
import { dispatchAction } from '@xrengine/hyperflux'

export type ModifyMaterialCommandUndoParams = {
  properties: { [_: string]: any }[]
}

export type ModifyMaterialCommandParams = CommandParams & {
  type: MiscCommands.MODIFY_MATERIAL
  materialId: string
  properties: { [_: string]: any }[]
  undo?: ModifyMaterialCommandUndoParams
}

function prepare(command: ModifyMaterialCommandParams) {
  const props = command.affectedNodes.filter((node) => typeof node === 'string') as string[]
  if (command.keepHistory) {
    command.undo = {
      properties: props.map((node, i) => {
        const mesh = obj3dFromUuid(node) as Mesh
        if (!mesh?.isMesh) throw new Error('Material host not defined')
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const material = materials.find((material) => material.uuid === command.materialId)
        if (!material?.isMaterial) throw new Error('Material is missing from host mesh')
        const oldProps = {} as any
        const propertyNames = Object.keys(command.properties[i] ?? command.properties[0])
        propertyNames.map((propertyName) => {
          const oldValue = material[propertyName]
          oldProps[propertyName] = typeof oldValue?.clone === 'function' ? oldValue.clone() : oldValue
        })
        return oldProps
      })
    }
  }
}

function shouldUpdate(currentCommand: ModifyMaterialCommandParams, newCommand: ModifyMaterialCommandParams): boolean {
  if (
    currentCommand.properties.length !== newCommand.properties.length ||
    !arrayShallowEqual(currentCommand.affectedNodes, newCommand.affectedNodes) ||
    currentCommand.materialId !== newCommand.materialId
  )
    return false

  return !currentCommand.properties.some((property, i) => {
    if (!arrayShallowEqual(Object.keys(property), Object.keys(newCommand.properties[i]))) {
      return true
    }
    return false
  })
}

function update(currentCommand: ModifyMaterialCommandParams, newCommand: ModifyMaterialCommandParams) {
  currentCommand.properties = newCommand.properties
  executeCommand(currentCommand)
}

function execute(command) {
  updateMaterial(command, false)
}

function undo(command) {
  updateMaterial(command, true)
}

function updateMaterial(command: ModifyMaterialCommandParams, isUndo?: boolean) {
  const properties = isUndo && command.undo ? command.undo.properties : command.properties
  const idCache = new Set<string>()
  command.affectedNodes.map((node, i) => {
    if (typeof node !== 'string') return
    const obj3d = obj3dFromUuid(node) as Mesh
    const materials = Array.isArray(obj3d.material) ? obj3d.material : [obj3d.material]
    const material = materials.find((material) => material.uuid === command.materialId)
    if (!material) throw new Error('Missing material')
    if (idCache.has(material.uuid)) return
    idCache.add(material.uuid)
    const props = properties[i] ?? properties[0]
    Object.entries(props).map(([k, v]) => {
      if (typeof v?.copy === 'function') {
        if (!material[k]) material[k] = new v.constructor()
        material[k].copy(v)
      } else if (typeof v !== 'undefined' && typeof material[k] === 'object' && typeof material[k].set === 'function') {
        material[k].set(v)
      } else {
        material[k] = v
      }
      dispatchAction(SelectionAction.changedObject({ objects: [node], propertyName: `material.${k}` }))
    })
    material.needsUpdate = true
  })
  dispatchAction(EditorAction.sceneModified({ modified: true }))
}

function toString(command: ModifyMaterialCommandParams) {
  return `Modify Material Command id: ${command.id} objects: ${serializeObject3DArray(
    command.affectedNodes
  )}\nmaterials: ${command.materialId}\nproperties: ${serializeProperties(command.properties)}`
}

export const ModifyMaterialCommand: CommandFuncType = {
  prepare,
  execute,
  undo,
  shouldUpdate,
  update,
  toString
}