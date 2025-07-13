import logo from '../../public/ostore_112.png'

export default () => {

    const version = import.meta.env.VITE_APP_VERSION

    return (<div class="flex flex-col items-center">
        <img src={logo} class="w-60px h-60px mt-20px" />
        <div class="text-16px font-bold">OStore</div>
        <div class="color-gray text-14px/14px">{version}</div>
        <div class="text-14px pt-16px">Orange app store for kaios 3.1</div>
    </div>)
}