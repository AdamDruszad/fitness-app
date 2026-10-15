/** "1 exercise", "3 exercises". Irregular plurals pass `many`. */
export function countLabel(count, one, many = `${one}s`) {
  return `${count} ${Number(count) === 1 ? one : many}`;
}
